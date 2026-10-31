import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { todayUtc } from "@/lib/rules";
import { insertDemoComplaints, upsertBankHolidays } from "@/scripts/lib/seed-db";
import { createTestDatabase, dbTestsEnabled, type TestDatabase, tx, USERS } from "./harness";

describe.skipIf(!dbTestsEnabled)("seed scripts", () => {
  let db: TestDatabase;
  let client: Client;

  beforeAll(async () => {
    db = await createTestDatabase();
    client = new Client({ connectionString: db.url });
    await client.connect();
  }, 60_000);

  afterAll(async () => {
    await client?.end();
    await db?.drop();
  });

  it("loads 25 synthetic complaints with their audit trail, once", async () => {
    expect(await insertDemoComplaints(client, { handler: USERS.handler, manager: USERS.manager }, todayUtc())).toBe(25);
    await expect(insertDemoComplaints(client, { handler: USERS.handler, manager: USERS.manager }, todayUtc())).rejects.toThrow(/already exist/);

    await tx(db.pool, async (t) => {
      await t.as(USERS.compliance);
      expect((await t.query("select * from public.complaints")).rowCount).toBe(25);
      const statuses = await t.query("select distinct status from public.complaints");
      expect(statuses.rowCount).toBe(14);
      const registered = await t.query("select * from public.complaint_events where event_type = 'registered'");
      expect(registered.rowCount).toBe(25);
    });
  });

  it("upserts bank holidays", async () => {
    const rows = [{ date: "2026-12-25", name: "Christmas Day", region: "england-and-wales" }];
    await upsertBankHolidays(client, rows);
    await upsertBankHolidays(client, rows);
    const result = await client.query("select * from public.bank_holidays");
    expect(result.rowCount).toBe(1);
  });
});
