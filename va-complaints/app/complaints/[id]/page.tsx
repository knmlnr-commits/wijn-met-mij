import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Rag } from "@/components/Rag";
import { RegulatoryClock } from "@/components/RegulatoryClock";
import { requirePageUser } from "@/lib/auth/session";
import { availableActions } from "@/lib/complaints/policy";
import { buildView } from "@/lib/complaints/view";
import { createUserClient } from "@/lib/db/client";
import { getComplaint, listEvents, listNotifications } from "@/lib/db/complaints";
import { type AppContext, loadContext, refLabel } from "@/lib/db/context";
import { DataError } from "@/lib/db/errors";
import type { ComplaintEventRow, ComplaintRow } from "@/lib/db/types";
import { ELIGIBILITY_LABELS, OUTCOME_LABELS, RESOLUTION_PATH_LABELS, STATUS_LABELS } from "@/lib/domain/complaint";
import { formatDate, formatDateTime, formatGBP } from "@/lib/format";
import { todayUtc } from "@/lib/rules";
import { ActionsPanel } from "./ActionsPanel";
import { EditDetails } from "./EditDetails";
import styles from "./detail.module.css";

export const metadata: Metadata = { title: "Complaint | Van Ameyde Complaints Management" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ComplaintPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageUser();
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const db = await createUserClient();
  let complaint: ComplaintRow;
  try {
    complaint = await getComplaint(db, id);
  } catch (error) {
    if (error instanceof DataError && error.kind === "not_found") notFound();
    throw error;
  }
  const [ctx, events, notifications] = await Promise.all([loadContext(db), listEvents(db, id), listNotifications(db, id)]);
  const today = todayUtc();
  const view = buildView(complaint, ctx, today);
  const actions = availableActions({
    complaint,
    timeline: view.timeline,
    insurerIsLloyds: view.insurer?.is_lloyds ?? false,
    role: user.role,
  });
  const editable = actions.find((a) => a.key === "edit")?.enabled ?? false;
  const options = (rows: { code: string; label: string; is_active: boolean }[]) => rows.map((r) => ({ value: r.code, label: r.is_active ? r.label : `${r.label} (inactive)` }));
  const names = new Map(ctx.profiles.map((p) => [p.id, p.display_name]));

  return (
    <div className="stack">
      <div className="page-header">
        <div>
          <p className="muted small">
            <Link href="/">Dashboard</Link> / {complaint.reference}
          </p>
          <h1>
            {complaint.reference} <span className="muted">{complaint.complainant_name}</span>
          </h1>
        </div>
        <div className="button-row">
          <span className="badge">{STATUS_LABELS[complaint.status]}</span>
          <Rag value={view.timeline.rag} />
          {complaint.vulnerable_customer && <span className="badge badge-rose">Vulnerable customer</span>}
          {complaint.is_deleted && <span className="badge badge-rose">Deleted</span>}
        </div>
      </div>

      <RegulatoryClock timeline={view.timeline} />

      <div className={styles.columns}>
        <ActionsPanel
          complaintId={complaint.id}
          today={today}
          actions={actions}
          firmShortName={ctx.firm?.firm_short_name ?? "Firm"}
          holdingRequiresFosRights={view.timeline.holdingRequiresFosRights}
        />
        <Details complaint={complaint} ctx={ctx} insurerName={view.insurerName} handlerName={view.handlerName} isLloyds={view.insurer?.is_lloyds ?? false} />
      </div>

      {editable && (
        <details className="card">
          <summary className={styles.summaryHeading}>Edit details</summary>
          <EditDetails
            complaint={complaint}
            today={today}
            handlers={ctx.profiles.filter((p) => p.is_active && p.role !== "compliance").map((p) => ({ value: p.id, label: p.display_name }))}
            coverholders={ctx.coverholders.map((c) => ({ value: c.id, label: c.is_active ? c.name : `${c.name} (inactive)` }))}
            lists={{
              complainantType: options(ctx.refs.ref_complainant_type),
              product: options(ctx.refs.ref_product),
              channel: options(ctx.refs.ref_channel),
              nature: options(ctx.refs.ref_nature_of_complaint),
              rootCause: options(ctx.refs.ref_root_cause),
              secondaryCause: options(ctx.refs.ref_secondary_cause),
              vulnerability: options(ctx.refs.ref_vulnerability_category),
            }}
          />
        </details>
      )}

      <section className="card stack" aria-labelledby="notifications-heading">
        <h2 id="notifications-heading">Notifications</h2>
        {notifications.length === 0 ? (
          <p className="muted">No customer communications yet.</p>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th scope="col">Created</th>
                  <th scope="col">Type</th>
                  <th scope="col">Channel</th>
                  <th scope="col">Status</th>
                  <th scope="col">Sent</th>
                </tr>
              </thead>
              <tbody>
                {notifications.map((n) => (
                  <tr key={n.id}>
                    <td>{formatDateTime(n.created_at)}</td>
                    <td>{n.type.replace("_", " ")}</td>
                    <td>{n.channel}</td>
                    <td>{n.status}</td>
                    <td>{n.sent_at ? formatDateTime(n.sent_at) : "Not sent"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card stack" aria-labelledby="audit-heading">
        <h2 id="audit-heading">Audit trail</h2>
        <AuditTrail events={events} names={names} />
      </section>
    </div>
  );
}

function Details({ complaint: c, ctx, insurerName, handlerName, isLloyds }: { complaint: ComplaintRow; ctx: AppContext; insurerName: string; handlerName: string; isLloyds: boolean }) {
  const coverholder = ctx.coverholders.find((h) => h.id === c.coverholder_id)?.name ?? "Not set";
  const address = [c.address_line1, c.address_line2, c.town, c.county, c.postcode, c.country].filter(Boolean).join(", ") || "Not set";
  const party = (p: string | null) => (p === "firm" ? (ctx.firm?.firm_short_name ?? "Firm") : p === "insurer" ? "Insurer" : "Not set");
  const yesNo = (v: boolean | null) => (v === null ? "Not set" : v ? "Yes" : "No");

  return (
    <section className="card stack" aria-label="Complaint details">
      <h2>Details</h2>
      <dl className="meta">
        <dt>Complaint type</dt>
        <dd>
          {insurerName}
          {isLloyds ? " (Lloyd's)" : ""}
        </dd>
        <dt>Handler</dt>
        <dd>{handlerName}</dd>
        <dt>Received</dt>
        <dd>{formatDate(c.received_date)}</dd>
        <dt>Into complaints</dt>
        <dd>{formatDate(c.received_into_complaints_date)}</dd>
        <dt>Complainant type</dt>
        <dd>{refLabel(ctx, "ref_complainant_type", c.complainant_type)}</dd>
        <dt>Email</dt>
        <dd>{c.complainant_email ?? "Not set"}</dd>
        <dt>Phone</dt>
        <dd>{c.complainant_phone ?? "Not set"}</dd>
        <dt>Address</dt>
        <dd>{address}</dd>
        <dt>Coverholder</dt>
        <dd>{coverholder}</dd>
        <dt>Product</dt>
        <dd>{refLabel(ctx, "ref_product", c.product)}</dd>
        <dt>Channel</dt>
        <dd>{refLabel(ctx, "ref_channel", c.channel)}</dd>
        <dt>Claim related</dt>
        <dd>{yesNo(c.claim_related)}</dd>
        <dt>Claim reference</dt>
        <dd>{c.claim_reference ?? "Not set"}</dd>
        <dt>Insurer reference</dt>
        <dd>{c.insurer_complaint_reference ?? "Not set"}</dd>
        <dt>Eligibility</dt>
        <dd>{c.eligibility ? ELIGIBILITY_LABELS[c.eligibility] : "Not set"}</dd>
        <dt>Nature</dt>
        <dd>{refLabel(ctx, "ref_nature_of_complaint", c.nature_of_complaint)}</dd>
        <dt>Root cause</dt>
        <dd>{refLabel(ctx, "ref_root_cause", c.root_cause)}</dd>
        <dt>Secondary cause</dt>
        <dd>{refLabel(ctx, "ref_secondary_cause", c.secondary_cause)}</dd>
        <dt>Vulnerability</dt>
        <dd>{c.vulnerable_customer ? refLabel(ctx, "ref_vulnerability_category", c.vulnerability_category) : "No"}</dd>
        <dt>Summary</dt>
        <dd className={styles.prose}>{c.summary}</dd>
        <dt>Findings</dt>
        <dd className={styles.prose}>{c.findings ?? "Not set"}</dd>
      </dl>
      <h3>Lifecycle</h3>
      <dl className="meta">
        <dt>Acknowledged</dt>
        <dd>{formatDate(c.acknowledged_date)}</dd>
        <dt>Holding response</dt>
        <dd>{formatDate(c.holding_response_date)}</dd>
        <dt>Resolution</dt>
        <dd>{c.resolution_path ? RESOLUTION_PATH_LABELS[c.resolution_path] : "Not resolved"}</dd>
        <dt>Final response</dt>
        <dd>{formatDate(c.final_response_date)}</dd>
        <dt>Outcome</dt>
        <dd>{c.outcome ? OUTCOME_LABELS[c.outcome] : "Not set"}</dd>
        <dt>Upheld against</dt>
        <dd>{party(c.upheld_against)}</dd>
        <dt>Compensation</dt>
        <dd>
          {formatGBP(c.compensation_amount)}
          {c.compensation_paid_by ? `, paid by ${party(c.compensation_paid_by)}` : ""}
        </dd>
        <dt>Referred to Lloyd&apos;s</dt>
        <dd>{formatDate(c.lloyds_referred_date)}</dd>
        <dt>Referred to FOS</dt>
        <dd>{formatDate(c.fos_referred_date)}</dd>
        <dt>FOS / Lloyd&apos;s reference</dt>
        <dd>{c.fos_lloyds_reference ?? "Not set"}</dd>
        <dt>Lloyd&apos;s outcome</dt>
        <dd>
          {c.lloyds_outcome ?? "Not set"}
          {c.lloyds_closed_date ? `, closed ${formatDate(c.lloyds_closed_date)}` : ""}
        </dd>
        <dt>FOS decision</dt>
        <dd>{c.fos_decision ?? "Not set"}</dd>
        <dt>Ombudsman decision</dt>
        <dd>
          {c.ombudsman_decision ?? "Not set"}
          {c.fos_closed_date ? `, closed ${formatDate(c.fos_closed_date)}` : ""}
        </dd>
        <dt>Awarded after FOS</dt>
        <dd>{formatGBP(c.compensation_awarded_after_fos)}</dd>
        <dt>Awarded after Lloyd&apos;s</dt>
        <dd>{formatGBP(c.compensation_awarded_after_lloyds)}</dd>
        <dt>Closed</dt>
        <dd>{formatDate(c.closed_date)}</dd>
      </dl>
    </section>
  );
}

function AuditTrail({ events, names }: { events: ComplaintEventRow[]; names: Map<string, string> }) {
  if (events.length === 0) return <p className="muted">No events.</p>;
  return (
    <ol className={styles.audit}>
      {[...events].reverse().map((e) => (
        <li key={e.id}>
          <div className={styles.auditHead}>
            <strong>{e.description}</strong>
            <span className="muted small">
              {formatDateTime(e.occurred_at)} · {e.actor_id ? (names.get(e.actor_id) ?? "Former user") : "System"}
            </span>
          </div>
          {e.event_type === "details_updated" && e.before && e.after && (
            <ul className="small">
              {Object.keys(e.after).map((field) => (
                <li key={field}>
                  {field.replaceAll("_", " ")}: <span className="muted">{String(e.before?.[field] ?? "empty")}</span> to {String(e.after?.[field] ?? "empty")}
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ol>
  );
}
