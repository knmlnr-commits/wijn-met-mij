import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDatabase, dbTestsEnabled, register, type TestDatabase, tx, type TxDb, USERS } from "./harness";

async function draft(t: TxDb, complaintId: string, channel = "email", recipient: string | null = "demo@example.test") {
  await t.as(USERS.handler);
  return (
    await t.one<{ id: string }>("select public.create_notification_draft($1, 'acknowledgement', $2, 'Subject\n\nBody', $3) as id", [complaintId, channel, recipient])
  ).id;
}

async function eventTypes(t: TxDb, complaintId: string) {
  await t.asOwner();
  return (await t.query<{ event_type: string }>("select event_type from public.complaint_events where complaint_id = $1 order by occurred_at, created_at", [complaintId])).rows.map(
    (r) => r.event_type,
  );
}

describe.skipIf(!dbTestsEnabled)("notification functions", () => {
  let db: TestDatabase;

  beforeAll(async () => {
    db = await createTestDatabase();
  }, 60_000);

  afterAll(async () => {
    await db?.drop();
  });

  it("drafts, edits and sends a notification, auditing every step", () =>
    tx(db.pool, async (t) => {
      const id = await register(t, USERS.handler);
      const n = await draft(t, id);
      await t.as(USERS.handler);
      await t.query("select public.update_notification_draft($1, 'Subject\n\nEdited body', 'email', 'demo@example.test')", [n]);
      await t.query("select public.mark_notification_sent($1, true)", [n]);
      await t.asOwner();
      const row = await t.one<{ status: string; rendered_content: string; sent_at: string | null; created_by: string }>(
        "select status, rendered_content, sent_at, created_by from public.notifications where id = $1",
        [n],
      );
      expect(row).toMatchObject({ status: "sent", rendered_content: "Subject\n\nEdited body", created_by: USERS.handler });
      expect(row.sent_at).not.toBeNull();
      expect(await eventTypes(t, id)).toEqual(["registered", "notification_created", "notification_updated", "notification_sent"]);
    }));

  it("keeps sent content final", () =>
    tx(db.pool, async (t) => {
      const id = await register(t, USERS.handler);
      const n = await draft(t, id, "letter", null);
      await t.query("select public.mark_notification_sent($1, true)", [n]);
      expect((await t.fails("select public.update_notification_draft($1, 'changed', 'letter', null)", [n])).message).toMatch(/Only a draft/);
      expect((await t.fails("select public.mark_notification_sent($1, true)", [n])).message).toMatch(/already been sent/);
    }));

  it("needs a recipient to send an email, and records a failed delivery", () =>
    tx(db.pool, async (t) => {
      const id = await register(t, USERS.handler);
      const noRecipient = await draft(t, id, "email", null);
      expect((await t.fails("select public.mark_notification_sent($1, true)", [noRecipient])).message).toMatch(/recipient/);
      const n = await draft(t, id);
      await t.query("select public.mark_notification_sent($1, false)", [n]);
      expect((await eventTypes(t, id)).at(-1)).toBe("notification_failed");
    }));

  it("rejects empty content", () =>
    tx(db.pool, async (t) => {
      const id = await register(t, USERS.handler);
      await t.as(USERS.handler);
      expect((await t.fails("select public.create_notification_draft($1, 'holding', 'letter', '   ')", [id])).message).toMatch(/no content/);
    }));

  it("compliance cannot draft, edit or send", () =>
    tx(db.pool, async (t) => {
      const id = await register(t, USERS.handler);
      const n = await draft(t, id);
      await t.as(USERS.compliance);
      expect((await t.fails("select public.create_notification_draft($1, 'holding', 'letter', 'x')", [id])).code).toBe("42501");
      expect((await t.fails("select public.update_notification_draft($1, 'x', 'letter', null)", [n])).code).toBe("42501");
      expect((await t.fails("select public.mark_notification_sent($1, true)", [n])).code).toBe("42501");
      expect((await t.query("select * from public.notifications")).rowCount).toBe(1);
    }));

  it("cannot notify on a deleted complaint", () =>
    tx(db.pool, async (t) => {
      const id = await register(t, USERS.handler);
      await t.as(USERS.manager);
      await t.query("select public.soft_delete_complaint($1, 'Duplicate')", [id]);
      await t.as(USERS.manager);
      expect((await t.fails("select public.create_notification_draft($1, 'holding', 'letter', 'x')", [id])).message).toMatch(/not found/);
    }));
});
