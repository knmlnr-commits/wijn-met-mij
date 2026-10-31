/**
 * Database writes for the seed scripts. Runs as the database owner (direct Postgres
 * connection), so it bypasses RLS; used only by scripts and tests, never by the app.
 */
import type { ClientBase } from "pg";
import type { IsoDate } from "@/lib/rules";
import type { BankHolidaySeed } from "@/lib/holidays/govuk";
import { generateDemoComplaints } from "./demo-data";

export interface DemoUsers {
  handler: string;
  manager: string;
}

/** Inserts the synthetic complaints and their audit events. Refuses when complaints already exist. */
export async function insertDemoComplaints(client: ClientBase, users: DemoUsers, today: IsoDate): Promise<number> {
  const existing = await client.query<{ n: string }>("select count(*) as n from public.complaints");
  if (Number(existing.rows[0].n) > 0) {
    throw new Error("Complaints already exist; demo data is only loaded into an empty database.");
  }
  const insurers = await client.query<{ id: string; name: string }>("select id, name from public.insurers");
  const insurerId = new Map(insurers.rows.map((r) => [r.name, r.id]));

  await client.query("begin");
  try {
    for (const demo of generateDemoComplaints(today)) {
      const id = insurerId.get(demo.insurer);
      if (!id) throw new Error(`Insurer ${demo.insurer} is not seeded; run supabase/seed.sql first.`);
      const owner = users[demo.assignTo];
      const columns = Object.keys(demo.row);
      const values = Object.values(demo.row);
      const placeholders = columns.map((_, i) => `$${i + 4}`).join(", ");
      const inserted = await client.query<{ id: string }>(
        `insert into public.complaints (insurer_id, created_by, handler_id, ${columns.join(", ")})
         values ($1, $2, $3, ${placeholders}) returning id`,
        [id, users.handler, owner, ...values],
      );
      for (const e of demo.events) {
        await client.query(
          `insert into public.complaint_events (complaint_id, occurred_at, actor_id, event_type, description, after)
           values ($1, ($2::date + time '12:00') at time zone 'utc', $3, $4, $5, $6)`,
          [inserted.rows[0].id, e.occurred_on, owner, e.event_type, e.description, e.after],
        );
      }
    }
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
  return generateDemoComplaints(today).length;
}

export async function upsertBankHolidays(client: ClientBase, holidays: readonly BankHolidaySeed[]): Promise<number> {
  for (const h of holidays) {
    await client.query(
      `insert into public.bank_holidays (date, name, region) values ($1, $2, $3)
       on conflict (region, date) do update set name = excluded.name`,
      [h.date, h.name, h.region],
    );
  }
  return holidays.length;
}

export async function upsertProfile(
  client: ClientBase,
  profile: { id: string; display_name: string; email: string; role: string },
): Promise<void> {
  await client.query(
    `insert into public.profiles (id, display_name, email, role, is_active) values ($1, $2, $3, $4, true)
     on conflict (id) do update set display_name = excluded.display_name, role = excluded.role, is_active = true`,
    [profile.id, profile.display_name, profile.email, profile.role],
  );
}
