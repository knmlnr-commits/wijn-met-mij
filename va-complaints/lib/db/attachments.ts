import "server-only";
import type { Db } from "./client";
import { check, DataError } from "./errors";
import type { AttachmentRow } from "./types";

/** Attachments to notifications. Lists carry no file content; the content is read one file at a time. */

const COLUMNS = "id, notification_id, complaint_id, file_name, content_type, size_bytes, created_at, created_by";

export async function listAttachments(db: Db, complaintId: string): Promise<AttachmentRow[]> {
  return check(
    await db.from("notification_attachments").select(COLUMNS).eq("complaint_id", complaintId).order("created_at", { ascending: true }),
  ) as AttachmentRow[];
}

export async function listNotificationAttachments(db: Db, notificationId: string): Promise<AttachmentRow[]> {
  return check(
    await db.from("notification_attachments").select(COLUMNS).eq("notification_id", notificationId).order("created_at", { ascending: true }),
  ) as AttachmentRow[];
}

export async function getAttachmentMeta(db: Db, id: string): Promise<AttachmentRow> {
  const row = check(await db.from("notification_attachments").select(COLUMNS).eq("id", id).maybeSingle()) as AttachmentRow | null;
  if (!row) throw new DataError("Attachment not found.", "not_found");
  return row;
}

export async function addAttachment(
  db: Db,
  notificationId: string,
  file: { fileName: string; contentType: string; bytes: Buffer },
): Promise<string> {
  return check(
    await db.rpc("add_notification_attachment", {
      p_notification_id: notificationId,
      p_file_name: file.fileName,
      p_content_type: file.contentType,
      p_content_base64: file.bytes.toString("base64"),
    }),
  ) as string;
}

export async function removeAttachment(db: Db, id: string): Promise<void> {
  check(await db.rpc("remove_notification_attachment", { p_id: id }));
}

export interface AttachmentFile {
  notificationId: string;
  complaintId: string;
  fileName: string;
  contentType: string;
  bytes: Buffer;
}

export async function getAttachmentFile(db: Db, id: string): Promise<AttachmentFile> {
  const rows = check(await db.rpc("get_notification_attachment", { p_id: id })) as
    | { notification_id: string; complaint_id: string; file_name: string; content_type: string; content_base64: string }[]
    | null;
  const row = rows?.[0];
  if (!row) throw new DataError("Attachment not found.", "not_found");
  return {
    notificationId: row.notification_id,
    complaintId: row.complaint_id,
    fileName: row.file_name,
    contentType: row.content_type,
    bytes: Buffer.from(row.content_base64, "base64"),
  };
}
