import { ServerForm } from "@/components/ServerForm";
import { hardDeleteAction } from "@/app/complaints/actions";
import { requirePageUser } from "@/lib/auth/session";
import { createUserClient } from "@/lib/db/client";
import { listDeletedComplaints } from "@/lib/db/complaints";
import { slaProfileFor } from "@/lib/db/profile";
import { getFirmSettings, listInsurers } from "@/lib/db/settings";
import { formatDate, formatDateTime } from "@/lib/format";
import { canHardDelete, retentionEnd, todayUtc } from "@/lib/rules";

export default async function RetentionPage() {
  await requirePageUser("manager");
  const db = await createUserClient();
  const [deleted, insurers, firm] = await Promise.all([listDeletedComplaints(db), listInsurers(db), getFirmSettings(db)]);
  const today = todayUtc();
  const rows = deleted.map((c) => {
    const profile = slaProfileFor(insurers.find((i) => i.id === c.insurer_id) ?? null, firm);
    return { c, until: retentionEnd(c.received_date, profile), past: canHardDelete(c.received_date, profile, today) };
  });
  const past = rows.filter((r) => r.past);

  return (
    <div className="stack">
      <p className="muted">
        Deleted complaints stay in the database until their retention period has passed (DISP 1.9: at least three years from receipt, longer where
        an insurer requires it). Only then can a Manager remove them permanently, with their audit trail. Each permanent deletion is logged without
        personal data.
      </p>

      <section className="card stack">
        <h2>Past retention ({past.length})</h2>
        {past.length === 0 ? (
          <p className="muted">No deleted complaints are past their retention period.</p>
        ) : (
          past.map(({ c, until }) => (
            <details key={c.id} className="card">
              <summary>
                <strong>{c.reference}</strong> <span className="muted small">received {formatDate(c.received_date)}, retention ended {formatDate(until)}</span>
              </summary>
              <ServerForm action={hardDeleteAction} submit="Delete permanently">
                <input type="hidden" name="complaintId" value={c.id} />
                <div className="field">
                  <label htmlFor={`purge-${c.id}`}>Reason</label>
                  <textarea id={`purge-${c.id}`} name="reason" required />
                </div>
              </ServerForm>
            </details>
          ))
        )}
      </section>

      <section className="card stack">
        <h2>Deleted, within retention ({rows.length - past.length})</h2>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th scope="col">Reference</th>
                <th scope="col">Received</th>
                <th scope="col">Deleted</th>
                <th scope="col">Keep until</th>
                <th scope="col">Reason</th>
              </tr>
            </thead>
            <tbody>
              {rows
                .filter((r) => !r.past)
                .map(({ c, until }) => (
                  <tr key={c.id}>
                    <td>{c.reference}</td>
                    <td>{formatDate(c.received_date)}</td>
                    <td>{c.deleted_at ? formatDateTime(c.deleted_at) : "Not set"}</td>
                    <td>{formatDate(until)}</td>
                    <td className="wrap">{c.deletion_reason}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
