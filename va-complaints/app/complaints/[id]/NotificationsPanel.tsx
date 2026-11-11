"use client";

import Link from "next/link";
import { useActionState } from "react";
import { AttachmentsField, FormMessage } from "@/components/forms";
import { ATTACHMENT_HINT, ATTACHMENT_MAX_PER_NOTIFICATION, formatFileSize } from "@/lib/attachments/rules";
import { IDLE } from "@/lib/actions/state";
import type { AttachmentRow, NotificationRow } from "@/lib/db/types";
import { NOTIFICATION_TYPES } from "@/lib/domain/complaint";
import { formatDateTime } from "@/lib/format";
import { hasPlaceholders, LETTER_TITLES } from "@/lib/letters/templates";
import { addAttachmentsAction, createNotificationAction, removeAttachmentAction, saveNotificationAction, sendNotificationAction } from "../notifications";
import styles from "./detail.module.css";

const STATUS_TEXT = { draft: "Draft", sent: "Sent", failed: "Failed" } as const;

function DraftEditor({ n, canWrite }: { n: NotificationRow; canWrite: boolean }) {
  const [saveResult, save, saving] = useActionState(saveNotificationAction, IDLE);
  const [sendResult, send, sending] = useActionState(sendNotificationAction, IDLE);
  const result = sendResult.message ? sendResult : saveResult;
  const blocked = hasPlaceholders(n.rendered_content);

  return (
    <form className="stack">
      <input type="hidden" name="notificationId" value={n.id} />
      <div className="form-grid">
        <div className="field">
          <label htmlFor={`channel-${n.id}`}>Send as</label>
          <select id={`channel-${n.id}`} name="channel" defaultValue={n.channel} disabled={!canWrite}>
            <option value="email">Email</option>
            <option value="letter">Printed letter</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor={`to-${n.id}`}>Recipient email (for email)</label>
          <input id={`to-${n.id}`} name="recipientEmail" type="email" defaultValue={n.recipient_email ?? ""} disabled={!canWrite} />
        </div>
      </div>
      <div className="field">
        <label htmlFor={`content-${n.id}`}>Content (first line is the email subject)</label>
        <textarea id={`content-${n.id}`} name="content" className={styles.letter} rows={18} defaultValue={n.rendered_content} readOnly={!canWrite} />
      </div>
      {blocked && (
        <p className="notice notice-warn small">
          This draft contains a placeholder marked with [[ ]]. It cannot be sent until the placeholder is replaced; referral wording is set by a Manager
          in Settings.
        </p>
      )}
      <FormMessage result={result} />
      {canWrite && (
        <div className="button-row">
          <button type="submit" formAction={save} className="button-secondary" disabled={saving || sending}>
            {saving ? "Saving..." : "Save draft"}
          </button>
          <button type="submit" formAction={send} className="button-primary" disabled={saving || sending}>
            {sending ? "Sending..." : "Send or issue"}
          </button>
        </div>
      )}
    </form>
  );
}

/** The files that go out with one letter or email. They can change while it is a draft and are fixed once it is sent. */
function Attachments({ n, complaintId, files, canWrite }: { n: NotificationRow; complaintId: string; files: AttachmentRow[]; canWrite: boolean }) {
  const [addResult, add, adding] = useActionState(addAttachmentsAction, IDLE);
  const [removeResult, remove, removing] = useActionState(removeAttachmentAction, IDLE);
  const editable = canWrite && n.status !== "sent";
  if (files.length === 0 && !editable) return null;
  const result = removeResult.message && !addResult.message ? removeResult : addResult.message ? addResult : removeResult;

  return (
    <div className={styles.attachments}>
      <h3>Attachments{files.length > 0 ? ` (${files.length})` : ""}</h3>
      {files.length === 0 ? (
        <p className="muted small">None. Files added here are sent along with this {n.channel === "email" ? "email" : "letter"}.</p>
      ) : (
        <ul className={styles.attachmentList}>
          {files.map((f) => (
            <li key={f.id}>
              <a href={`/complaints/${complaintId}/attachments/${f.id}`} download>
                {f.file_name}
              </a>
              <span className="muted small">{formatFileSize(f.size_bytes)}</span>
              {editable && (
                <form action={remove}>
                  <input type="hidden" name="attachmentId" value={f.id} />
                  <button type="submit" className="button-link" disabled={removing} aria-label={`Remove ${f.file_name}`}>
                    Remove
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
      {n.status !== "sent" && n.channel === "letter" && files.length > 0 && (
        <p className="muted small">For a printed letter, download and print the attachments as enclosures.</p>
      )}
      {editable && files.length < ATTACHMENT_MAX_PER_NOTIFICATION && (
        <form action={add} className={styles.attachmentAdd}>
          <input type="hidden" name="notificationId" value={n.id} />
          <AttachmentsField label="Add attachments" hint={ATTACHMENT_HINT} />
          <button type="submit" className="button-secondary" disabled={adding}>
            {adding ? "Uploading..." : "Add"}
          </button>
        </form>
      )}
      <FormMessage result={result} />
    </div>
  );
}

export function NotificationsPanel({
  complaintId,
  notifications,
  attachments,
  canWrite,
}: {
  complaintId: string;
  notifications: NotificationRow[];
  attachments: AttachmentRow[];
  canWrite: boolean;
}) {
  const [createResult, create, creating] = useActionState(createNotificationAction, IDLE);

  return (
    <section className="card stack" aria-labelledby="notifications-heading" id="notifications">
      <h2 id="notifications-heading">Notifications</h2>
      <p className="small muted">
        Recording an acknowledgement, holding response, summary resolution or final response creates a letter draft here. Review and edit it, then
        send it by email or issue it as a printed letter. Attachments added at the step, or on the draft, are sent along. The content sent is kept
        with the complaint.
      </p>

      {notifications.length === 0 && <p className="muted">No customer communications yet.</p>}

      {[...notifications].reverse().map((n) => (
        <details key={n.id} className="card" open={n.status !== "sent"}>
          <summary>
            <strong>{LETTER_TITLES[n.type]}</strong> <span className="badge">{STATUS_TEXT[n.status]}</span>{" "}
            {attachments.some((a) => a.notification_id === n.id) && (
              <span className="badge">{attachments.filter((a) => a.notification_id === n.id).length} attached</span>
            )}{" "}
            <span className="muted small">
              {n.channel === "email" ? "Email" : "Letter"}, created {formatDateTime(n.created_at)}
              {n.sent_at ? `, sent ${formatDateTime(n.sent_at)}` : ""}
            </span>
          </summary>
          {n.status === "sent" ? (
            <div className="stack">
              <pre className={styles.letterView}>{n.rendered_content}</pre>
              <p className="button-row">
                {n.channel === "letter" && (
                  <Link href={`/complaints/${complaintId}/letters/${n.id}`} target="_blank">
                    Open printable letter
                  </Link>
                )}
                <a href={`/complaints/${complaintId}/letters/${n.id}/pdf`} download>
                  Download PDF
                </a>
              </p>
            </div>
          ) : (
            <DraftEditor n={n} canWrite={canWrite} />
          )}
          <Attachments n={n} complaintId={complaintId} files={attachments.filter((a) => a.notification_id === n.id)} canWrite={canWrite} />
        </details>
      ))}

      {canWrite && (
        <form action={create} className="form-grid">
          <input type="hidden" name="complaintId" value={complaintId} />
          <div className="field">
            <label htmlFor="new-letter-type">Create a new draft</label>
            <select id="new-letter-type" name="type" defaultValue="acknowledgement">
              {NOTIFICATION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {LETTER_TITLES[t]}
                </option>
              ))}
            </select>
          </div>
          <div className="button-row" style={{ alignItems: "flex-end" }}>
            <button type="submit" className="button-secondary" disabled={creating}>
              {creating ? "Creating..." : "Create draft"}
            </button>
          </div>
          <div className="full">
            <FormMessage result={createResult} />
          </div>
        </form>
      )}
    </section>
  );
}
