import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ATTACHMENT_MAX_BYTES, ATTACHMENT_MAX_PER_NOTIFICATION, ATTACHMENT_TYPES } from "@/lib/attachments/rules";
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

describe.skipIf(!dbTestsEnabled)("notification attachments", () => {
  let db: TestDatabase;
  const PDF = Buffer.from("%PDF-1.4 synthetic test file").toString("base64");

  beforeAll(async () => {
    db = await createTestDatabase();
  }, 60_000);

  afterAll(async () => {
    await db?.drop();
  });

  const add = (t: TxDb, n: string, name = "terms.pdf", type = "application/pdf", content = PDF) =>
    t.one<{ id: string }>("select public.add_notification_attachment($1, $2, $3, $4) as id", [n, name, type, content]);

  it("adds, reads and removes a file on a draft, auditing each step", () =>
    tx(db.pool, async (t) => {
      const id = await register(t, USERS.handler);
      const n = await draft(t, id);
      await t.as(USERS.handler);
      const a = (await add(t, n)).id;
      const meta = await t.one<{ file_name: string; size_bytes: number }>("select file_name, size_bytes from public.notification_attachments where id = $1", [a]);
      expect(meta).toEqual({ file_name: "terms.pdf", size_bytes: 28 });
      const file = await t.one<{ content_base64: string; complaint_id: string }>("select * from public.get_notification_attachment($1)", [a]);
      expect(file.content_base64.replace(/\s/g, "")).toBe(PDF);
      expect(file.complaint_id).toBe(id);
      await t.query("select public.remove_notification_attachment($1)", [a]);
      expect((await t.query("select id from public.notification_attachments where notification_id = $1", [n])).rows).toEqual([]);
      expect(await eventTypes(t, id)).toEqual(["registered", "notification_created", "attachment_added", "attachment_removed"]);
    }));

  it("keeps the file content out of direct reads and blocks direct writes", () =>
    tx(db.pool, async (t) => {
      const id = await register(t, USERS.handler);
      const n = await draft(t, id);
      await t.as(USERS.handler);
      const a = (await add(t, n)).id;
      expect((await t.fails("select content from public.notification_attachments where id = $1", [a])).message).toMatch(/permission denied/);
      expect((await t.fails("delete from public.notification_attachments where id = $1", [a])).message).toMatch(/permission denied/);
      expect((await t.fails("update public.notification_attachments set file_name = 'x.pdf' where id = $1", [a])).message).toMatch(/permission denied/);
    }));

  it("lets compliance read but not change, and gives other users nothing", () =>
    tx(db.pool, async (t) => {
      const id = await register(t, USERS.handler);
      const n = await draft(t, id);
      await t.as(USERS.handler);
      const a = (await add(t, n)).id;
      await t.as(USERS.compliance);
      expect((await t.query("select * from public.get_notification_attachment($1)", [a])).rows.length).toBe(1);
      expect((await t.fails("select public.add_notification_attachment($1, $2, $3, $4) as id", [n, "more.pdf", "application/pdf", PDF])).message).toMatch(/./);
      expect((await t.fails("select public.remove_notification_attachment($1)", [a])).message).toMatch(/./);
    }));

  it("uses the same limits as the application", () =>
    tx(db.pool, async (t) => {
      const row = await t.one<{ bytes: number; count: number; types: string[] }>(
        "select app.attachment_max_bytes() as bytes, app.attachment_max_per_notification() as count, app.attachment_content_types() as types",
      );
      expect(row.bytes).toBe(ATTACHMENT_MAX_BYTES);
      expect(row.count).toBe(ATTACHMENT_MAX_PER_NOTIFICATION);
      expect([...row.types].sort()).toEqual(ATTACHMENT_TYPES.map((x) => x.contentType).sort());
    }));

  it("fixes the attachments once the notification is sent", () =>
    tx(db.pool, async (t) => {
      const id = await register(t, USERS.handler);
      const n = await draft(t, id);
      await t.as(USERS.handler);
      const a = (await add(t, n)).id;
      await t.query("select public.mark_notification_sent($1, true)", [n]);
      expect((await t.fails("select public.add_notification_attachment($1, $2, $3, $4) as id", [n, "late.pdf", "application/pdf", PDF])).message).toMatch(/once the notification is sent/);
      expect((await t.fails("select public.remove_notification_attachment($1)", [a])).message).toMatch(/once the notification is sent/);
    }));

  it("refuses wrong types, bad names, empty and oversized files, and more than the maximum", () =>
    tx(db.pool, async (t) => {
      const id = await register(t, USERS.handler);
      const n = await draft(t, id);
      await t.as(USERS.handler);
      expect((await t.fails("select public.add_notification_attachment($1, $2, $3, $4) as id", [n, "run.exe", "application/x-msdownload", PDF])).message).toMatch(/type of file/);
      expect((await t.fails("select public.add_notification_attachment($1, $2, $3, $4) as id", [n, "../etc/passwd.pdf", "application/pdf", PDF])).message).toMatch(/file name/);
      expect((await t.fails("select public.add_notification_attachment($1, $2, $3, $4) as id", [n, "empty.pdf", "application/pdf", ""])).message).toMatch(/empty/);
      const big = Buffer.alloc(3 * 1024 * 1024 + 1, 65).toString("base64");
      expect((await t.fails("select public.add_notification_attachment($1, $2, $3, $4) as id", [n, "big.pdf", "application/pdf", big])).message).toMatch(/too large/);
      for (let i = 0; i < 5; i += 1) await add(t, n, `file-${i}.pdf`);
      expect((await t.fails("select public.add_notification_attachment($1, $2, $3, $4) as id", [n, "sixth.pdf", "application/pdf", PDF])).message).toMatch(/maximum number/);
    }));
});
