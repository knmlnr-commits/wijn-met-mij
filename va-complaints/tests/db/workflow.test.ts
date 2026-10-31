import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { EDITABLE_FIELDS } from "@/lib/domain/complaint";
import { resolveProfile, retentionEnd } from "@/lib/rules";
import { createTestDatabase, dbTestsEnabled, register, type TestDatabase, tx, type TxDb, USERS } from "./harness";

const INVALID = "22023";

async function events(t: TxDb, id: string) {
  await t.asOwner();
  return (
    await t.query<{ event_type: string; actor_id: string; before: unknown; after: unknown }>(
      "select event_type, actor_id, before, after from public.complaint_events where complaint_id = $1 order by occurred_at, created_at",
      [id],
    )
  ).rows;
}

async function complaint(t: TxDb, id: string) {
  await t.asOwner();
  return t.one<Record<string, unknown>>(
    "select *, to_char(received_date, 'YYYY-MM-DD') as received, to_char(acknowledged_date, 'YYYY-MM-DD') as acknowledged from public.complaints where id = $1",
    [id],
  );
}

describe.skipIf(!dbTestsEnabled)("workflow functions", () => {
  let db: TestDatabase;

  beforeAll(async () => {
    db = await createTestDatabase();
  }, 60_000);

  afterAll(async () => {
    await db?.drop();
  });

  describe("register", () => {
    it("creates a New complaint with a C-XXXXXX reference and a registered event by the same user", () =>
      tx(db.pool, async (t) => {
        const id = await register(t, USERS.handler);
        const c = await complaint(t, id);
        expect(c.reference).toMatch(/^C-\d{6}$/);
        expect(c.status).toBe("new");
        expect(c.created_by).toBe(USERS.handler);
        expect(c.handler_id).toBe(USERS.handler);
        expect(c.received).toBe("2026-10-01");
        expect(await events(t, id)).toMatchObject([{ event_type: "registered", actor_id: USERS.handler }]);
      }));

    it("rejects a received date in the future", () =>
      tx(db.pool, async (t) => {
        await t.as(USERS.handler);
        const error = await t.fails(
          "select public.register_complaint(jsonb_build_object('insurer_id', (select id from public.insurers limit 1), 'received_date', (now() at time zone 'utc')::date + 1, 'complainant_name', 'x', 'summary', 'x'))",
        );
        expect(error.message).toMatch(/future/);
      }));

    it("rejects unknown fields, an inactive insurer and missing required fields", () =>
      tx(db.pool, async (t) => {
        expect((await registerFails(t, { status: "closed" })).message).toMatch(/not allowed: status/);
        await t.asOwner();
        await t.query("update public.insurers set is_active = false where name = 'Aviva'");
        expect((await registerFails(t, { insurer: "Aviva" })).message).toMatch(/active insurer/);
        expect((await registerFails(t, { complainant_name: " " })).code).toBe("23514");
        expect((await registerFails(t, { summary: null })).code).toBe("23502");
      }));

    it("requires a vulnerability category when the customer is vulnerable", () =>
      tx(db.pool, async (t) => {
        expect((await registerFails(t, { vulnerable_customer: true })).message).toMatch(/vulnerability_category_required/);
      }));

    async function registerFails(t: TxDb, fields: Record<string, unknown>) {
      await t.asOwner();
      const insurer = await t.one<{ id: string }>("select id from public.insurers where name = $1", [fields.insurer ?? "Zurich"]);
      const payload: Record<string, unknown> = {
        insurer_id: insurer.id,
        received_date: "2026-10-01",
        complainant_name: "Demo",
        summary: "Synthetic",
        ...fields,
      };
      delete payload.insurer;
      await t.as(USERS.handler);
      return t.fails("select public.register_complaint($1::jsonb)", [JSON.stringify(payload)]);
    }
  });

  describe("received date and registration details are locked", () => {
    it("cannot be changed, even by the table owner", () =>
      tx(db.pool, async (t) => {
        const id = await register(t, USERS.handler);
        await t.asOwner();
        expect((await t.fails("update public.complaints set received_date = '2026-09-01' where id = $1", [id])).message).toMatch(/cannot be changed/);
        expect((await t.fails("update public.complaints set reference = 'C-999999' where id = $1", [id])).message).toMatch(/cannot be changed/);
      }));

    it("is not an editable detail", () =>
      tx(db.pool, async (t) => {
        const id = await register(t, USERS.handler);
        await t.as(USERS.handler);
        const error = await t.fails("select public.update_complaint_details($1, '{\"received_date\": \"2026-09-01\"}'::jsonb)", [id]);
        expect(error.message).toMatch(/not allowed: received_date/);
        const insurer = await t.fails("select public.update_complaint_details($1, '{\"insurer_id\": null}'::jsonb)", [id]);
        expect(insurer.message).toMatch(/not allowed: insurer_id/);
      }));
  });

  describe("edit details", () => {
    it("writes a details_updated event with before and after for changed fields only", () =>
      tx(db.pool, async (t) => {
        const id = await register(t, USERS.handler);
        await t.as(USERS.handler);
        await t.query("select public.update_complaint_details($1, $2::jsonb)", [
          id,
          JSON.stringify({ summary: "Updated synthetic summary", town: "Testtown", complainant_name: "Demo Complainant" }),
        ]);
        const log = await events(t, id);
        expect(log).toHaveLength(2);
        expect(log[1]).toMatchObject({
          event_type: "details_updated",
          before: { summary: "Synthetic test complaint about claim handling.", town: null },
          after: { summary: "Updated synthetic summary", town: "Testtown" },
        });
      }));

    it("writes no event when nothing changes", () =>
      tx(db.pool, async (t) => {
        const id = await register(t, USERS.handler);
        await t.as(USERS.handler);
        await t.query("select public.update_complaint_details($1, '{\"complainant_name\": \"Demo Complainant\"}'::jsonb)", [id]);
        expect(await events(t, id)).toHaveLength(1);
      }));
  });

  describe("acknowledgement", () => {
    it("sets the date, moves New to Acknowledged and logs the event", () =>
      tx(db.pool, async (t) => {
        const id = await register(t, USERS.handler);
        await t.as(USERS.handler);
        await t.query("select public.record_acknowledgement($1, '2026-10-02')", [id]);
        const c = await complaint(t, id);
        expect(c.acknowledged).toBe("2026-10-02");
        expect(c.status).toBe("acknowledged");
        expect((await events(t, id)).map((e) => e.event_type)).toEqual(["registered", "acknowledged"]);
      }));

    it("rejects a second acknowledgement, a date before receipt and a future date, leaving no event behind", () =>
      tx(db.pool, async (t) => {
        const id = await register(t, USERS.handler);
        await t.as(USERS.handler);
        expect((await t.fails("select public.record_acknowledgement($1, '2026-09-30')", [id])).message).toMatch(/before the received date/);
        expect((await t.fails("select public.record_acknowledgement($1, (now() at time zone 'utc')::date + 1)", [id])).message).toMatch(/future/);
        expect(await events(t, id)).toHaveLength(1);
        await t.as(USERS.handler);
        await t.query("select public.record_acknowledgement($1, '2026-10-02')", [id]);
        expect((await t.fails("select public.record_acknowledgement($1, '2026-10-03')", [id])).message).toMatch(/already acknowledged/);
      }));
  });

  describe("resolution", () => {
    it("final response requires an outcome, and upheld against when upheld", () =>
      tx(db.pool, async (t) => {
        const id = await register(t, USERS.handler);
        await t.as(USERS.handler);
        expect((await t.fails("select public.record_final_response($1, '2026-10-10', null)", [id])).code).toBe(INVALID);
        expect((await t.fails("select public.record_final_response($1, '2026-10-10', 'upheld')", [id])).message).toMatch(/Upheld against/);
        expect((await t.fails("select public.record_final_response($1, '2026-10-10', 'upheld', 'firm', 150.00)", [id])).message).toMatch(/paid by/);
        await t.query("select public.record_final_response($1, '2026-10-10', 'upheld', 'firm', 150.00, 'firm', 'Synthetic findings')", [id]);
        const c = await complaint(t, id);
        expect(c).toMatchObject({ status: "resolved", resolution_path: "final_response", outcome: "upheld", upheld_against: "firm", compensation_amount: "150.00" });
        expect((await events(t, id)).at(-1)?.event_type).toBe("final_response_sent");
      }));

    it("summary resolution is blocked once a final response is sent, and vice versa", () =>
      tx(db.pool, async (t) => {
        const a = await register(t, USERS.handler);
        await t.as(USERS.handler);
        await t.query("select public.record_final_response($1, '2026-10-10', 'not_upheld')", [a]);
        expect((await t.fails("select public.record_summary_resolution($1)", [a])).message).toMatch(/already resolved/);

        const b = await register(t, USERS.handler);
        await t.as(USERS.handler);
        await t.query("select public.record_summary_resolution($1, 'Resolved by phone')", [b]);
        expect((await complaint(t, b)).status).toBe("resolved");
        await t.as(USERS.handler);
        expect((await t.fails("select public.record_final_response($1, '2026-10-10', 'not_upheld')", [b])).message).toMatch(/already resolved/);
        expect((await t.fails("select public.record_holding_response($1, '2026-10-10')", [b])).message).toMatch(/already resolved/);
      }));

    it("compensation status needs a resolved complaint", () =>
      tx(db.pool, async (t) => {
        const id = await register(t, USERS.handler);
        await t.as(USERS.handler);
        expect((await t.fails("select public.set_compensation_status($1, 'compensation_paid')", [id])).message).toMatch(/not yet resolved/);
        await t.query("select public.record_final_response($1, '2026-10-10', 'upheld', 'insurer', 50, 'insurer')", [id]);
        await t.query("select public.set_compensation_status($1, 'compensation_outstanding')", [id]);
        await t.query("select public.set_compensation_status($1, 'compensation_paid')", [id]);
        expect((await complaint(t, id)).status).toBe("compensation_paid");
      }));
  });

  describe("escalation", () => {
    it("refers to the FOS only after a final response, then records the outcome", () =>
      tx(db.pool, async (t) => {
        const id = await register(t, USERS.handler);
        await t.as(USERS.handler);
        expect((await t.fails("select public.refer_to_fos($1, '2026-10-20')", [id])).message).toMatch(/final response must be sent/);
        expect((await t.fails("select public.record_fos_outcome($1, 'Upheld')", [id])).message).toMatch(/not been referred/);
        await t.query("select public.record_final_response($1, '2026-10-10', 'not_upheld')", [id]);
        await t.query("select public.refer_to_fos($1, '2026-10-20', 'FOS-TEST-1')", [id]);
        await t.query("select public.record_fos_outcome($1, 'Not upheld', null, '2026-10-25', null, true)", [id]);
        const c = await complaint(t, id);
        expect(c).toMatchObject({ status: "actions_required_following_decision", fos_lloyds_reference: "FOS-TEST-1", fos_decision: "Not upheld" });
      }));

    it("refers to Lloyd's only for a Lloyd's insurer", () =>
      tx(db.pool, async (t) => {
        const zurich = await register(t, USERS.handler);
        await t.as(USERS.handler);
        await t.query("select public.record_final_response($1, '2026-10-10', 'not_upheld')", [zurich]);
        expect((await t.fails("select public.refer_to_lloyds($1, '2026-10-20')", [zurich])).message).toMatch(/Lloyd's insurer/);

        const lloyds = await register(t, USERS.handler, { insurer: "Lloyd's" });
        await t.as(USERS.handler);
        await t.query("select public.record_final_response($1, '2026-10-10', 'not_upheld')", [lloyds]);
        await t.query("select public.refer_to_lloyds($1, '2026-10-20', 'LLOYDS-TEST-1')", [lloyds]);
        expect((await complaint(t, lloyds)).status).toBe("referred_to_lloyds");
      }));
  });

  describe("status and closing", () => {
    it("allows only the manual statuses and nothing after closing", () =>
      tx(db.pool, async (t) => {
        const id = await register(t, USERS.handler);
        await t.as(USERS.handler);
        expect((await t.fails("select public.set_complaint_status($1, 'closed')", [id])).message).toMatch(/cannot be set directly/);
        expect((await t.fails("select public.set_complaint_status($1, 'resolved')", [id])).message).toMatch(/cannot be set directly/);
        await t.query("select public.set_complaint_status($1, 'investigating')", [id]);
        await t.query("select public.close_complaint($1, '2026-10-15')", [id]);
        expect((await complaint(t, id)).status).toBe("closed");
        await t.as(USERS.handler);
        expect((await t.fails("select public.set_complaint_status($1, 'investigating')", [id])).message).toMatch(/closed/);
        expect((await events(t, id)).map((e) => e.event_type)).toEqual(["registered", "status_changed", "closed"]);
      }));
  });

  describe("deletion", () => {
    it("soft delete needs a reason", () =>
      tx(db.pool, async (t) => {
        const id = await register(t, USERS.handler);
        await t.as(USERS.manager);
        expect((await t.fails("select public.soft_delete_complaint($1, ' ')", [id])).message).toMatch(/reason/);
        await t.query("select public.soft_delete_complaint($1, 'Duplicate registration')", [id]);
        const c = await complaint(t, id);
        expect(c.is_deleted).toBe(true);
        expect(c.deleted_by).toBe(USERS.manager);
        await t.as(USERS.handler);
        expect((await t.fails("select public.record_acknowledgement($1, '2026-10-02')", [id])).message).toMatch(/not found/);
      }));

    it("hard delete is blocked unless soft deleted and past retention", () =>
      tx(db.pool, async (t) => {
        const recent = await register(t, USERS.handler);
        await t.as(USERS.manager);
        expect((await t.fails("select public.hard_delete_complaint($1, 'Retention')", [recent])).message).toMatch(/soft deleted/);
        await t.query("select public.soft_delete_complaint($1, 'Duplicate')", [recent]);
        expect((await t.fails("select public.hard_delete_complaint($1, 'Retention')", [recent])).message).toMatch(/Retention period has not passed/);
      }));

    it("hard delete after retention removes the complaint and its audit trail and logs the purge", () =>
      tx(db.pool, async (t) => {
        const old = await register(t, USERS.handler, { received_date: "2020-01-06" });
        await t.as(USERS.manager);
        await t.query("select public.soft_delete_complaint($1, 'Past retention')", [old]);
        const reference = (await complaint(t, old)).reference;
        await t.as(USERS.manager);
        await t.query("select public.hard_delete_complaint($1, 'Retention period passed')", [old]);
        await t.asOwner();
        expect((await t.query("select 1 from public.complaints where id = $1", [old])).rowCount).toBe(0);
        expect((await t.query("select 1 from public.complaint_events where complaint_id = $1", [old])).rowCount).toBe(0);
        const log = await t.one<{ complaint_reference: string; purged_by: string }>("select * from public.complaint_purge_log");
        expect(log).toMatchObject({ complaint_reference: reference, purged_by: USERS.manager });
        // The purge flag does not leak: the audit trail is append only again.
        await register(t, USERS.handler);
        await t.asOwner();
        expect((await t.fails("delete from public.complaint_events")).message).toMatch(/append only/);
      }));
  });

  describe("editable fields stay in step", () => {
    it("the SQL list matches the TypeScript list", () =>
      tx(db.pool, async (t) => {
        const row = await t.one<{ fields: string[] }>("select app.editable_complaint_fields() as fields");
        expect([...row.fields].sort()).toEqual([...EDITABLE_FIELDS].sort());
      }));
  });

  describe("SQL retention matches the rules engine", () => {
    it.each([
      ["2026-06-01", 3],
      ["2024-02-29", 3],
      ["2024-02-29", 4],
      ["2023-12-31", 6],
    ] as const)("retention end for %s plus %i years", (received, years) =>
      tx(db.pool, async (t) => {
        const row = await t.one<{ end: string }>("select to_char(app.retention_end($1::date, $2), 'YYYY-MM-DD') as end", [received, years]);
        expect(row.end).toBe(retentionEnd(received, resolveProfile({ retentionYears: years })));
      }));
  });
});
