import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDatabase, dbTestsEnabled, register, type TestDatabase, tx, USERS } from "./harness";

const PERMISSION_DENIED = "42501";

describe.skipIf(!dbTestsEnabled)("RLS and grants per role", () => {
  let db: TestDatabase;

  beforeAll(async () => {
    db = await createTestDatabase();
  }, 60_000);

  afterAll(async () => {
    await db?.drop();
  });

  describe("no access without an active profile", () => {
    it("anon has no table or function access", () =>
      tx(db.pool, async (t) => {
        await t.asAnon();
        expect((await t.fails("select * from public.complaints")).code).toBe(PERMISSION_DENIED);
        expect((await t.fails("select * from public.insurers")).code).toBe(PERMISSION_DENIED);
        expect((await t.fails("select public.register_complaint('{}'::jsonb)")).code).toBe(PERMISSION_DENIED);
      }));

    it("a login without a profile sees nothing and cannot act", () =>
      tx(db.pool, async (t) => {
        await t.as(USERS.noProfile);
        expect((await t.query("select * from public.insurers")).rowCount).toBe(0);
        expect((await t.query("select * from public.firm_settings")).rowCount).toBe(0);
        expect((await t.fails("select public.register_complaint('{}'::jsonb)")).code).toBe(PERMISSION_DENIED);
      }));

    it("an inactive profile sees nothing and cannot act", () =>
      tx(db.pool, async (t) => {
        const id = await register(t, USERS.handler);
        await t.as(USERS.inactive);
        expect((await t.query("select * from public.complaints")).rowCount).toBe(0);
        expect((await t.query("select * from public.profiles")).rowCount).toBe(0);
        expect((await t.fails("select public.record_acknowledgement($1, '2026-10-02')", [id])).code).toBe(PERMISSION_DENIED);
      }));
  });

  describe("reading", () => {
    it.each(["handler", "manager", "compliance"] as const)("%s reads settings, insurers and complaints", (role) =>
      tx(db.pool, async (t) => {
        await register(t, USERS.handler);
        await t.as(USERS[role]);
        expect((await t.query("select * from public.insurers")).rowCount).toBe(5);
        expect((await t.query("select * from public.firm_settings")).rowCount).toBe(1);
        expect((await t.query("select * from public.complaints")).rowCount).toBe(1);
        expect((await t.query("select * from public.complaint_events")).rowCount).toBe(1);
      }));
  });

  describe("handler", () => {
    it("cannot change firm settings", () =>
      tx(db.pool, async (t) => {
        await t.as(USERS.handler);
        const result = await t.query("update public.firm_settings set firm_name = 'Changed'");
        expect(result.rowCount).toBe(0);
        await t.asOwner();
        expect((await t.one<{ firm_name: string }>("select firm_name from public.firm_settings")).firm_name).toBe("Van Ameyde");
      }));

    it("cannot change insurers, coverholders, reference lists or bank holidays", () =>
      tx(db.pool, async (t) => {
        await t.as(USERS.handler);
        expect((await t.fails("insert into public.insurers (name) values ('New insurer')")).code).toBe(PERMISSION_DENIED);
        expect((await t.fails("insert into public.coverholders (name) values ('New coverholder')")).code).toBe(PERMISSION_DENIED);
        expect((await t.fails("insert into public.ref_product (code, label) values ('X', 'X')")).code).toBe(PERMISSION_DENIED);
        expect((await t.fails("insert into public.bank_holidays (date, name, region) values ('2026-12-31', 'X', 'england-and-wales')")).code).toBe(PERMISSION_DENIED);
        expect((await t.query("update public.insurers set final_response_days = 90")).rowCount).toBe(0);
        expect((await t.query("delete from public.ref_complainant_type")).rowCount).toBe(0);
      }));

    it("cannot raise their own role", () =>
      tx(db.pool, async (t) => {
        await t.as(USERS.handler);
        expect((await t.query("update public.profiles set role = 'manager' where id = $1", [USERS.handler])).rowCount).toBe(0);
        await t.asOwner();
        expect((await t.one<{ role: string }>("select role from public.profiles where id = $1", [USERS.handler])).role).toBe("handler");
      }));

    it("cannot write complaints, events or notifications directly, only through workflow functions", () =>
      tx(db.pool, async (t) => {
        const id = await register(t, USERS.handler);
        await t.as(USERS.handler);
        expect((await t.fails("update public.complaints set status = 'closed' where id = $1", [id])).code).toBe(PERMISSION_DENIED);
        expect((await t.fails("insert into public.complaint_events (complaint_id, event_type, description) values ($1, 'closed', 'x')", [id])).code).toBe(PERMISSION_DENIED);
        expect((await t.fails("insert into public.notifications (complaint_id, type, channel, rendered_content) values ($1, 'holding', 'letter', 'x')", [id])).code).toBe(PERMISSION_DENIED);
      }));

    it("cannot delete complaints", () =>
      tx(db.pool, async (t) => {
        const id = await register(t, USERS.handler);
        await t.as(USERS.handler);
        expect((await t.fails("select public.soft_delete_complaint($1, 'reason')", [id])).code).toBe(PERMISSION_DENIED);
        expect((await t.fails("select public.hard_delete_complaint($1, 'reason')", [id])).code).toBe(PERMISSION_DENIED);
      }));

    it("cannot call private helpers", () =>
      tx(db.pool, async (t) => {
        const id = await register(t, USERS.handler);
        await t.as(USERS.handler);
        expect((await t.fails("select app.log_event($1, 'closed', 'forged')", [id])).code).toBe(PERMISSION_DENIED);
      }));
  });

  describe("manager", () => {
    it("maintains settings, insurers, coverholders, reference lists and bank holidays", () =>
      tx(db.pool, async (t) => {
        await t.as(USERS.manager);
        expect((await t.query("update public.firm_settings set bank_holidays_enabled = false")).rowCount).toBe(1);
        await t.query("insert into public.insurers (name, final_response_days) values ('Synthetic Insurer', 56)");
        await t.query("insert into public.coverholders (name) values ('Synthetic Coverholder')");
        await t.query("insert into public.ref_product (code, label) values ('TEST', 'Test product')");
        await t.query("insert into public.bank_holidays (date, name, region) values ('2026-12-31', 'Test', 'england-and-wales')");
        await t.query("update public.profiles set is_active = false where id = $1", [USERS.inactive]);
      }));

    it("cannot edit or delete audit events either", () =>
      tx(db.pool, async (t) => {
        await register(t, USERS.handler);
        await t.as(USERS.manager);
        expect((await t.fails("update public.complaint_events set description = 'edited'")).code).toBe(PERMISSION_DENIED);
        expect((await t.fails("delete from public.complaint_events")).code).toBe(PERMISSION_DENIED);
      }));
  });

  describe("compliance is read only", () => {
    it("cannot call any workflow function", () =>
      tx(db.pool, async (t) => {
        const id = await register(t, USERS.handler);
        await t.as(USERS.compliance);
        const calls: [string, unknown[]][] = [
          ["select public.register_complaint($1::jsonb)", [JSON.stringify({ complainant_name: "x", summary: "x" })]],
          ["select public.update_complaint_details($1, '{\"summary\": \"x\"}'::jsonb)", [id]],
          ["select public.set_complaint_status($1, 'investigating')", [id]],
          ["select public.record_acknowledgement($1, '2026-10-02')", [id]],
          ["select public.record_holding_response($1, '2026-10-02')", [id]],
          ["select public.record_summary_resolution($1)", [id]],
          ["select public.record_final_response($1, '2026-10-02', 'not_upheld')", [id]],
          ["select public.refer_to_fos($1, '2026-10-02')", [id]],
          ["select public.refer_to_lloyds($1, '2026-10-02')", [id]],
          ["select public.record_fos_outcome($1, 'x')", [id]],
          ["select public.record_lloyds_outcome($1, 'x')", [id]],
          ["select public.set_compensation_status($1, 'compensation_paid')", [id]],
          ["select public.close_complaint($1, '2026-10-02')", [id]],
          ["select public.soft_delete_complaint($1, 'x')", [id]],
          ["select public.hard_delete_complaint($1, 'x')", [id]],
        ];
        for (const [sql, params] of calls) {
          expect((await t.fails(sql, params)).code, sql).toBe(PERMISSION_DENIED);
        }
      }));

    it("cannot write to any table", () =>
      tx(db.pool, async (t) => {
        await register(t, USERS.handler);
        await t.as(USERS.compliance);
        expect((await t.query("update public.firm_settings set firm_name = 'x'")).rowCount).toBe(0);
        expect((await t.query("update public.insurers set is_active = false")).rowCount).toBe(0);
        expect((await t.fails("insert into public.ref_root_cause (code, label) values ('X', 'X')")).code).toBe(PERMISSION_DENIED);
        expect((await t.fails("update public.complaints set summary = 'x'")).code).toBe(PERMISSION_DENIED);
        expect((await t.fails("delete from public.complaint_events")).code).toBe(PERMISSION_DENIED);
      }));
  });

  describe("audit trail is append only for everyone", () => {
    it.each(["asServiceRole", "asOwner"] as const)("rejects update, delete and truncate %s", (mode) =>
      tx(db.pool, async (t) => {
        await register(t, USERS.handler);
        await t[mode]();
        expect((await t.fails("update public.complaint_events set description = 'edited'")).message).toMatch(/append only/);
        expect((await t.fails("delete from public.complaint_events")).message).toMatch(/append only/);
        expect((await t.fails("truncate public.complaint_events")).message).toMatch(/append only|permission denied/);
      }));
  });

  describe("soft deleted complaints", () => {
    it("are hidden from handlers and visible to manager and compliance", () =>
      tx(db.pool, async (t) => {
        const id = await register(t, USERS.handler);
        await t.as(USERS.manager);
        await t.query("select public.soft_delete_complaint($1, 'Registered in error')", [id]);
        await t.as(USERS.handler);
        expect((await t.query("select * from public.complaints")).rowCount).toBe(0);
        await t.as(USERS.manager);
        expect((await t.query("select * from public.complaints")).rowCount).toBe(1);
        await t.as(USERS.compliance);
        expect((await t.query("select * from public.complaints")).rowCount).toBe(1);
      }));
  });
});
