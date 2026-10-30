/**
 * Loads England and Wales bank holidays from gov.uk into the bank_holidays table.
 * Usage: SUPABASE_DB_URL=postgresql://... npm run seed:holidays
 */
import { Client } from "pg";
import { GOV_UK_BANK_HOLIDAYS_URL, parseGovUkBankHolidays } from "./lib/bank-holidays";
import { upsertBankHolidays } from "./lib/seed-db";

async function main() {
  const url = process.env.SUPABASE_DB_URL;
  if (!url) throw new Error("Set SUPABASE_DB_URL (see .env.example)");

  const response = await fetch(GOV_UK_BANK_HOLIDAYS_URL);
  if (!response.ok) throw new Error(`gov.uk returned ${response.status}`);
  const holidays = parseGovUkBankHolidays(await response.json());

  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const count = await upsertBankHolidays(client, holidays);
    console.log(`Loaded ${count} England and Wales bank holidays (${holidays[0]?.date} to ${holidays.at(-1)?.date}).`);
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Seeding bank holidays failed");
  process.exit(1);
});
