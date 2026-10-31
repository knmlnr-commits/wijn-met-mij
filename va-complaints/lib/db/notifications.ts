import "server-only";
import type { NotificationChannel, NotificationType } from "@/lib/domain/complaint";
import type { Db } from "./client";
import { check, DataError } from "./errors";
import type { NotificationRow } from "./types";

/** Notification repository. Every change is a workflow function that writes its audit event. */

export async function getNotification(db: Db, id: string): Promise<NotificationRow> {
  const row = check(await db.from("notifications").select("*").eq("id", id).maybeSingle()) as NotificationRow | null;
  if (!row) throw new DataError("Notification not found.", "not_found");
  return row;
}

export async function createNotificationDraft(
  db: Db,
  input: { complaintId: string; type: NotificationType; channel: NotificationChannel; content: string; recipientEmail: string | null },
): Promise<string> {
  return check(
    await db.rpc("create_notification_draft", {
      p_complaint_id: input.complaintId,
      p_type: input.type,
      p_channel: input.channel,
      p_content: input.content,
      p_recipient_email: input.recipientEmail,
    }),
  ) as string;
}

export async function updateNotificationDraft(
  db: Db,
  id: string,
  input: { channel: NotificationChannel; content: string; recipientEmail: string | null },
): Promise<void> {
  check(await db.rpc("update_notification_draft", { p_id: id, p_content: input.content, p_channel: input.channel, p_recipient_email: input.recipientEmail }));
}

export async function markNotificationSent(db: Db, id: string, success: boolean): Promise<void> {
  check(await db.rpc("mark_notification_sent", { p_id: id, p_success: success }));
}
