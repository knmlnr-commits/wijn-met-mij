/**
 * Creates the three demo users (handler, manager, compliance) and 25 synthetic complaints.
 * Sandbox and local use only; refuses to load complaints into a database that already has some.
 *
 * Usage: npm run seed:demo
 * Needs NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_DB_URL and DEMO_USER_PASSWORD.
 */
import { createClient } from "@supabase/supabase-js";
import { Client } from "pg";
import { DEMO_ACCOUNTS } from "@/lib/auth/config";
import { ROLES } from "@/lib/domain/complaint";
import { todayUtc } from "@/lib/rules";
import { insertDemoComplaints, upsertProfile } from "./lib/seed-db";

const DEMO_USERS = ROLES.map((role) => ({
  key: role,
  email: DEMO_ACCOUNTS[role].email,
  display_name: DEMO_ACCOUNTS[role].displayName,
  role,
}));

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Set ${name} (see .env.example)`);
  return value;
}

async function main() {
  const supabase = createClient(required("NEXT_PUBLIC_SUPABASE_URL"), required("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const password = required("DEMO_USER_PASSWORD");
  if (password.length < 12) throw new Error("DEMO_USER_PASSWORD must be at least 12 characters");

  const { data: existing, error: listError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (listError) throw new Error("Could not list users");

  const ids: Record<string, string> = {};
  for (const user of DEMO_USERS) {
    const found = existing.users.find((u) => u.email === user.email);
    if (found) {
      ids[user.key] = found.id;
      continue;
    }
    const { data, error } = await supabase.auth.admin.createUser({ email: user.email, password, email_confirm: true });
    if (error || !data.user) throw new Error(`Could not create the ${user.key} demo user`);
    ids[user.key] = data.user.id;
  }

  const db = new Client({ connectionString: required("SUPABASE_DB_URL") });
  await db.connect();
  try {
    for (const user of DEMO_USERS) {
      await upsertProfile(db, { id: ids[user.key], display_name: user.display_name, email: user.email, role: user.role });
    }
    const count = await insertDemoComplaints(db, { handler: ids.handler, manager: ids.manager }, todayUtc());
    console.log(`Created ${DEMO_USERS.length} demo users and ${count} synthetic complaints.`);
  } finally {
    await db.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Seeding demo data failed");
  process.exit(1);
});
