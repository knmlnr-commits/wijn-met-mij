/**
 * Database test harness. Creates a throwaway database on the server in TEST_DATABASE_URL,
 * applies the test auth shim, every migration and the seed, and runs each test inside a
 * transaction that is rolled back. Tests are skipped when TEST_DATABASE_URL is not set.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Client, type DatabaseError, Pool, type PoolClient, type QueryResultRow } from "pg";

export const ADMIN_URL = process.env.TEST_DATABASE_URL;
export const dbTestsEnabled = Boolean(ADMIN_URL);

const SUPABASE_DIR = join(__dirname, "..", "..", "supabase");

export const USERS = {
  handler: "00000000-0000-4000-8000-000000000001",
  manager: "00000000-0000-4000-8000-000000000002",
  compliance: "00000000-0000-4000-8000-000000000003",
  inactive: "00000000-0000-4000-8000-000000000004",
  noProfile: "00000000-0000-4000-8000-000000000005",
} as const;

export interface TestDatabase {
  pool: Pool;
  url: string;
  drop(): Promise<void>;
}

export function sqlFiles(): string[] {
  const migrations = readdirSync(join(SUPABASE_DIR, "migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => join(SUPABASE_DIR, "migrations", f));
  return [join(SUPABASE_DIR, "tests", "auth-shim.sql"), ...migrations, join(SUPABASE_DIR, "seed.sql")];
}

export async function createTestDatabase(): Promise<TestDatabase> {
  if (!ADMIN_URL) throw new Error("TEST_DATABASE_URL is not set");
  const name = `va_test_${process.pid}_${Math.random().toString(36).slice(2, 8)}`;
  const admin = new Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await admin.query(`create database ${name}`);
  await admin.end();

  const url = new URL(ADMIN_URL);
  url.pathname = `/${name}`;
  const pool = new Pool({ connectionString: url.toString(), max: 4 });
  for (const file of sqlFiles()) await pool.query(readFileSync(file, "utf8"));
  await seedTestUsers(pool);

  return {
    pool,
    url: url.toString(),
    async drop() {
      await pool.end();
      const c = new Client({ connectionString: ADMIN_URL });
      await c.connect();
      await c.query(`drop database if exists ${name} with (force)`);
      await c.end();
    },
  };
}

async function seedTestUsers(pool: Pool): Promise<void> {
  const rows: [string, string, string, boolean][] = [
    [USERS.handler, "Test Handler", "handler", true],
    [USERS.manager, "Test Manager", "manager", true],
    [USERS.compliance, "Test Compliance", "compliance", true],
    [USERS.inactive, "Test Inactive", "handler", false],
  ];
  for (const id of Object.values(USERS)) {
    await pool.query("insert into auth.users (id, email) values ($1, $2)", [id, `${id}@example.test`]);
  }
  for (const [id, name, role, active] of rows) {
    await pool.query(
      "insert into public.profiles (id, display_name, email, role, is_active) values ($1, $2, $3, $4, $5)",
      [id, name, `${id}@example.test`, role, active],
    );
  }
}

/** A connection inside an open transaction, with helpers to act as a role. */
export class TxDb {
  constructor(private readonly client: PoolClient) {}

  /** Act as a signed in user (Supabase `authenticated` role with the user's JWT claims). */
  async as(userId: string): Promise<this> {
    await this.client.query("reset role");
    await this.client.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: userId, role: "authenticated" })]);
    await this.client.query("set local role authenticated");
    return this;
  }

  async asAnon(): Promise<this> {
    await this.client.query("reset role");
    await this.client.query("select set_config('request.jwt.claims', '', true)");
    await this.client.query("set local role anon");
    return this;
  }

  async asServiceRole(): Promise<this> {
    await this.client.query("reset role");
    await this.client.query("select set_config('request.jwt.claims', '', true)");
    await this.client.query("set local role service_role");
    return this;
  }

  /** The table owner (migrations user); bypasses RLS but not triggers. */
  async asOwner(): Promise<this> {
    await this.client.query("reset role");
    await this.client.query("select set_config('request.jwt.claims', '', true)");
    return this;
  }

  async query<R extends QueryResultRow = QueryResultRow>(sql: string, params: unknown[] = []) {
    return this.client.query<R>(sql, params);
  }

  async one<R extends QueryResultRow = QueryResultRow>(sql: string, params: unknown[] = []): Promise<R> {
    const result = await this.client.query<R>(sql, params);
    if (result.rows.length !== 1) throw new Error(`Expected one row, got ${result.rows.length}`);
    return result.rows[0];
  }

  /** Runs a statement that must fail; returns the error. The transaction stays usable. */
  async fails(sql: string, params: unknown[] = []): Promise<DatabaseError> {
    await this.client.query("savepoint expect_error");
    try {
      await this.client.query(sql, params);
    } catch (error) {
      await this.client.query("rollback to savepoint expect_error");
      return error as DatabaseError;
    }
    await this.client.query("release savepoint expect_error");
    throw new Error(`Expected statement to fail: ${sql}`);
  }
}

/** Runs `fn` in a transaction that is always rolled back, so tests never affect each other. */
export async function tx<T>(pool: Pool, fn: (db: TxDb) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    return await fn(new TxDb(client));
  } finally {
    await client.query("rollback").catch(() => undefined);
    client.release();
  }
}

export const VALID_COMPLAINT = {
  complainant_name: "Demo Complainant",
  summary: "Synthetic test complaint about claim handling.",
};

/** Registers a complaint through the workflow function as the given user; returns its id. */
export async function register(db: TxDb, userId: string, fields: Record<string, unknown> = {}): Promise<string> {
  await db.as(userId);
  const insurer = await db.one<{ id: string }>("select id from public.insurers where name = $1", [fields.insurer ?? "Zurich"]);
  const payload: Record<string, unknown> = { insurer_id: insurer.id, received_date: "2026-10-01", ...VALID_COMPLAINT, ...fields };
  delete payload.insurer;
  const row = await db.one<{ id: string }>("select public.register_complaint($1::jsonb) as id", [JSON.stringify(payload)]);
  return row.id;
}
