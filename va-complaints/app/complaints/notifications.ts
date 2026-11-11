"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { type ActionResult, failure, formToObject, invalid } from "@/lib/actions/result";
import { requireRole } from "@/lib/auth/session";
import { PolicyError } from "@/lib/complaints/policy";
import { createUserClient } from "@/lib/db/client";
import { filesFrom, prepareAttachments, storeAttachments } from "@/lib/attachments/upload";
import { getAttachmentFile, getAttachmentMeta, listNotificationAttachments, removeAttachment } from "@/lib/db/attachments";
import { createDraftFor } from "@/lib/letters/drafts";
import { getNotification, markNotificationSent, updateNotificationDraft } from "@/lib/db/notifications";
import { NOTIFICATION_CHANNELS, NOTIFICATION_TYPES } from "@/lib/domain/complaint";
import { getEmailProvider } from "@/lib/email/provider";
import { hasPlaceholders } from "@/lib/letters/templates";
import { splitStoredLetter } from "@/lib/letters/stored";

/**
 * Customer notifications: a draft is rendered from the templates, the handler reviews and edits
 * it, then sends it by email (through the email provider) or issues it as a printed letter.
 * The final content is stored on the notification and every step is in the audit trail.
 */

const WRITERS = ["handler", "manager"] as const;

const createSchema = z.object({ complaintId: z.uuid(), type: z.enum(NOTIFICATION_TYPES) });

const draftSchema = z.object({
  notificationId: z.uuid(),
  channel: z.enum(NOTIFICATION_CHANNELS),
  content: z.string().trim().min(1, { message: "The letter has no content" }).max(50_000),
  recipientEmail: z
    .email({ message: "Enter a valid email address" })
    .max(320)
    .nullable()
    .optional()
    .transform((v) => v ?? null),
});

type Draft = { channel: string; content: string; recipientEmail: string | null };

function changed(current: { channel: string; rendered_content: string; recipient_email: string | null }, draft: Draft): boolean {
  const norm = (text: string) => text.replace(/\r\n/g, "\n").trim();
  return current.channel !== draft.channel || norm(current.rendered_content) !== norm(draft.content) || (current.recipient_email ?? null) !== draft.recipientEmail;
}

function refresh(complaintId: string) {
  revalidatePath(`/complaints/${complaintId}`);
}

export async function createNotificationAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const parsed = createSchema.safeParse(formToObject(form));
  if (!parsed.success) return invalid(parsed.error);
  try {
    await requireRole(...WRITERS);
    await createDraftFor(await createUserClient(), parsed.data.complaintId, parsed.data.type);
  } catch (error) {
    return failure(error);
  }
  refresh(parsed.data.complaintId);
  return { ok: true, message: "Draft created. Review it before sending." };
}

export async function saveNotificationAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const parsed = draftSchema.safeParse(formToObject(form, { keepEmpty: ["content"] }));
  if (!parsed.success) return invalid(parsed.error);
  const { notificationId, ...draft } = parsed.data;
  let complaintId: string;
  try {
    await requireRole(...WRITERS);
    const db = await createUserClient();
    const current = await getNotification(db, notificationId);
    complaintId = current.complaint_id;
    if (!changed(current, draft)) return { ok: true, message: "No changes to save." };
    await updateNotificationDraft(db, notificationId, draft);
  } catch (error) {
    return failure(error);
  }
  refresh(complaintId);
  return { ok: true, message: "Draft saved." };
}

/** Saves the reviewed content, then sends the email or records the printed letter as issued. */
export async function sendNotificationAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const parsed = draftSchema.safeParse(formToObject(form, { keepEmpty: ["content"] }));
  if (!parsed.success) return invalid(parsed.error);
  const { notificationId, ...draft } = parsed.data;
  let complaintId: string;
  let delivered = true;
  try {
    await requireRole(...WRITERS);
    if (hasPlaceholders(draft.content)) {
      throw new PolicyError("The letter still has a placeholder marked with [[ ]]. Complete it, or ask a Manager to add the referral wording in Settings.");
    }
    if (draft.channel === "email" && !draft.recipientEmail) throw new PolicyError("Enter the recipient's email address.");
    const db = await createUserClient();
    const current = await getNotification(db, notificationId);
    complaintId = current.complaint_id;
    if (current.status === "sent") throw new PolicyError("This notification has already been sent.");
    // An unchanged draft is sent as it is; only a real edit is written to the audit trail.
    if (changed(current, draft)) await updateNotificationDraft(db, notificationId, draft);
    if (draft.channel === "email") {
      const { subject, text } = splitStoredLetter(draft.content);
      const files = await Promise.all((await listNotificationAttachments(db, notificationId)).map((a) => getAttachmentFile(db, a.id)));
      const attachments = files.map((f) => ({ fileName: f.fileName, contentType: f.contentType, content: f.bytes }));
      delivered = (await getEmailProvider().send({ to: draft.recipientEmail as string, subject, text, attachments })).ok;
    }
    await markNotificationSent(db, notificationId, delivered);
  } catch (error) {
    return failure(error);
  }
  refresh(complaintId);
  if (!delivered) return { ok: false, message: "The email could not be sent. It is marked as failed; you can try again." };
  return { ok: true, message: draft.channel === "email" ? "Email sent." : "Letter recorded as issued. Print it from the letter view." };
}

/** Adds files to a draft letter or email; they are sent along with it. */
export async function addAttachmentsAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const parsed = z.object({ notificationId: z.uuid() }).safeParse({ notificationId: form.get("notificationId") });
  if (!parsed.success) return invalid(parsed.error);
  const files = filesFrom(form);
  if (files.length === 0) return { ok: false, message: "Choose a file first." };
  let complaintId: string;
  try {
    await requireRole(...WRITERS);
    const db = await createUserClient();
    const current = await getNotification(db, parsed.data.notificationId);
    complaintId = current.complaint_id;
    if (current.status === "sent") throw new PolicyError("This notification has already been sent; its attachments are fixed.");
    const existing = (await listNotificationAttachments(db, current.id)).length;
    await storeAttachments(db, current.id, await prepareAttachments(files, existing));
  } catch (error) {
    return failure(error);
  }
  refresh(complaintId);
  return { ok: true, message: files.length === 1 ? "Attachment added." : `${files.length} attachments added.` };
}

export async function removeAttachmentAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const parsed = z.object({ attachmentId: z.uuid() }).safeParse({ attachmentId: form.get("attachmentId") });
  if (!parsed.success) return invalid(parsed.error);
  let complaintId: string;
  try {
    await requireRole(...WRITERS);
    const db = await createUserClient();
    complaintId = (await getAttachmentMeta(db, parsed.data.attachmentId)).complaint_id;
    await removeAttachment(db, parsed.data.attachmentId);
  } catch (error) {
    return failure(error);
  }
  refresh(complaintId);
  return { ok: true, message: "Attachment removed." };
}
