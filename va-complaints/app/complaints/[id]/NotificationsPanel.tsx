"use client";

import Link from "next/link";
import { useActionState } from "react";
import { FormMessage } from "@/components/forms";
import { IDLE } from "@/lib/actions/state";
import type { NotificationRow } from "@/lib/db/types";
import { NOTIFICATION_TYPES } from "@/lib/domain/complaint";
import { formatDateTime } from "@/lib/format";
import { hasPlaceholders, LETTER_TITLES } from "@/lib/letters/templates";
import { createNotificationAction, saveNotificationAction, sendNotificationAction } from "../notifications";
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
        <textarea id={`content-${n.id}`} name="content" className={styles.letter} defaultValue={n.rendered_content} readOnly={!canWrite} />
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

export function NotificationsPanel({ complaintId, notifications, canWrite }: { complaintId: string; notifications: NotificationRow[]; canWrite: boolean }) {
  const [createResult, create, creating] = useActionState(createNotificationAction, IDLE);

  return (
    <section className="card stack" aria-labelledby="notifications-heading">
      <h2 id="notifications-heading">Notifications</h2>
      <p className="small muted">
        Recording an acknowledgement, holding response, summary resolution or final response creates a letter draft here. Review and edit it, then
        send it by email or issue it as a printed letter. The content sent is kept with the complaint.
      </p>

      {notifications.length === 0 && <p className="muted">No customer communications yet.</p>}

      {[...notifications].reverse().map((n) => (
        <details key={n.id} className="card" open={n.status !== "sent"}>
          <summary>
            <strong>{LETTER_TITLES[n.type]}</strong> <span className="badge">{STATUS_TEXT[n.status]}</span>{" "}
            <span className="muted small">
              {n.channel === "email" ? "Email" : "Letter"}, created {formatDateTime(n.created_at)}
              {n.sent_at ? `, sent ${formatDateTime(n.sent_at)}` : ""}
            </span>
          </summary>
          {n.status === "sent" ? (
            <div className="stack">
              <pre className={styles.letterView}>{n.rendered_content}</pre>
              {n.channel === "letter" && (
                <p>
                  <Link href={`/complaints/${complaintId}/letters/${n.id}`} target="_blank">
                    Open printable letter
                  </Link>
                </p>
              )}
            </div>
          ) : (
            <DraftEditor n={n} canWrite={canWrite} />
          )}
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
