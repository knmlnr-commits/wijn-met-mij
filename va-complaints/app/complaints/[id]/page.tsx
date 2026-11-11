import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Rag } from "@/components/Rag";
import { RegulatoryClock } from "@/components/RegulatoryClock";
import { requirePageUser } from "@/lib/auth/session";
import { nextStep } from "@/lib/complaints/next-step";
import { ACTION_LABELS, availableActions } from "@/lib/complaints/policy";
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
import { NotificationsPanel } from "./NotificationsPanel";
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
  const step = nextStep(complaint, view.timeline);
  const stepAction = step.action && actions.find((a) => a.key === step.action)?.enabled ? step.action : null;
  const readOnly = user.role === "compliance";
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
          <p className={styles.subline}>
            {view.insurerName}
            {view.insurer?.is_lloyds ? " (Lloyd's procedure)" : ""} · Handler {view.handlerName} · Received {formatDate(complaint.received_date)}
          </p>
        </div>
        <div className="button-row">
          <span className="badge">{STATUS_LABELS[complaint.status]}</span>
          <Rag value={view.timeline.rag} />
          {complaint.status === "compensation_outstanding" && <span className="rag rag-amber">Compensation outstanding</span>}
          {complaint.vulnerable_customer && <span className="badge badge-rose">Vulnerable customer</span>}
          {complaint.is_deleted && <span className="badge badge-rose">Deleted</span>}
        </div>
      </div>

      <section className={`${styles.banner} ${styles[step.tone]}`} aria-label="Next step">
        <div>
          <div className={styles.bannerLabel}>{step.tone === "done" ? "Status" : "Next step"}</div>
          <div className={styles.bannerTitle}>{step.title}</div>
          {step.detail && <div className="small muted">{step.detail}</div>}
        </div>
        {stepAction && !readOnly && (
          <a href="#actions" className="button-primary">
            {ACTION_LABELS[stepAction]}
          </a>
        )}
      </section>

      <RegulatoryClock timeline={view.timeline} />

      <div className={styles.columns}>
        {readOnly ? (
          <section className="card stack" aria-label="Actions">
            <h2>Actions</h2>
            <p className="muted">Compliance has read only access: you can see everything on this complaint, including the audit trail, but not change it.</p>
          </section>
        ) : (
          <ActionsPanel
            complaintId={complaint.id}
            today={today}
            actions={actions}
            firmShortName={ctx.firm?.firm_short_name ?? "Firm"}
            holdingRequiresFosRights={view.timeline.holdingRequiresFosRights}
            recommended={stepAction}
          />
        )}
        <div className={styles.side}>
          <NotificationsPanel complaintId={complaint.id} notifications={notifications} canWrite={editable && !readOnly} />
          <Details complaint={complaint} ctx={ctx} isLloyds={view.insurer?.is_lloyds ?? false}>
            {editable && (
              <details>
                <summary className={styles.editToggle}>Edit details</summary>
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
          </Details>
        </div>
      </div>

      <section className="card stack" aria-labelledby="audit-heading">
        <h2 id="audit-heading">Audit trail</h2>
        <AuditTrail events={events} names={names} />
      </section>
    </div>
  );
}

type Item = [label: string, value: string | null];

function Group({ title, items }: { title: string; items: Item[] }) {
  const filled = items.filter(([, v]) => v !== null && v !== "");
  if (filled.length === 0) return null;
  return (
    <>
      <h3>{title}</h3>
      <dl className="meta">
        {filled.map(([label, value]) => (
          <div key={label} style={{ display: "contents" }}>
            <dt>{label}</dt>
            <dd className={label === "Summary" || label === "Findings" ? styles.prose : undefined}>{value}</dd>
          </div>
        ))}
      </dl>
    </>
  );
}

/** Shows what has been recorded; fields without a value are listed in one line instead of row by row. */
function Details({ complaint: c, ctx, isLloyds, children }: { complaint: ComplaintRow; ctx: AppContext; isLloyds: boolean; children?: React.ReactNode }) {
  const ref = (table: Parameters<typeof refLabel>[1], code: string | null) => (code ? refLabel(ctx, table, code) : null);
  const party = (p: string | null) => (p === "firm" ? (ctx.firm?.firm_short_name ?? "Firm") : p === "insurer" ? "Insurer" : null);
  const yesNo = (v: boolean | null) => (v === null ? null : v ? "Yes" : "No");
  const date = (d: string | null) => (d ? formatDate(d) : null);
  const money = (n: number | null) => (n === null ? null : formatGBP(n));
  const address = [c.address_line1, c.address_line2, c.town, c.county, c.postcode, c.country].filter(Boolean).join(", ") || null;

  const complaint: Item[] = [
    ["Summary", c.summary],
    ["Findings", c.findings],
    ["Received into complaints", date(c.received_into_complaints_date)],
    ["Vulnerability", c.vulnerable_customer ? (ref("ref_vulnerability_category", c.vulnerability_category) ?? "Yes") : null],
  ];
  const complainant: Item[] = [
    ["Type", ref("ref_complainant_type", c.complainant_type)],
    ["Email", c.complainant_email],
    ["Phone", c.complainant_phone],
    ["Address", address],
  ];
  const classification: Item[] = [
    ["Coverholder", ctx.coverholders.find((h) => h.id === c.coverholder_id)?.name ?? null],
    ["Product", ref("ref_product", c.product)],
    ["Channel", ref("ref_channel", c.channel)],
    ["Claim related", yesNo(c.claim_related)],
    ["Claim reference", c.claim_reference],
    ["Insurer reference", c.insurer_complaint_reference],
    ["Eligibility", c.eligibility ? ELIGIBILITY_LABELS[c.eligibility] : null],
    ["Nature", ref("ref_nature_of_complaint", c.nature_of_complaint)],
    ["Root cause", ref("ref_root_cause", c.root_cause)],
    ["Secondary cause", ref("ref_secondary_cause", c.secondary_cause)],
  ];
  const outcome: Item[] = [
    ["Acknowledged", date(c.acknowledged_date)],
    ["Holding response", date(c.holding_response_date)],
    ["Resolution", c.resolution_path ? RESOLUTION_PATH_LABELS[c.resolution_path] : null],
    ["Final response", date(c.final_response_date)],
    ["Outcome", c.outcome ? OUTCOME_LABELS[c.outcome] : null],
    ["Upheld against", party(c.upheld_against)],
    ["Compensation", c.compensation_amount === null ? null : `${formatGBP(c.compensation_amount)}${c.compensation_paid_by ? `, paid by ${party(c.compensation_paid_by)}` : ""}`],
    [isLloyds ? "Referred to Lloyd's" : "", date(c.lloyds_referred_date)],
    ["Referred to FOS", date(c.fos_referred_date)],
    ["FOS / Lloyd's reference", c.fos_lloyds_reference],
    ["Lloyd's outcome", c.lloyds_outcome ? `${c.lloyds_outcome}${c.lloyds_closed_date ? `, closed ${formatDate(c.lloyds_closed_date)}` : ""}` : null],
    ["FOS decision", c.fos_decision ? `${c.fos_decision}${c.fos_closed_date ? `, closed ${formatDate(c.fos_closed_date)}` : ""}` : null],
    ["Ombudsman decision", c.ombudsman_decision],
    ["Awarded after FOS", money(c.compensation_awarded_after_fos)],
    ["Awarded after Lloyd's", money(c.compensation_awarded_after_lloyds)],
    ["Closed", date(c.closed_date)],
  ];
  const empty = [...complainant, ...classification].filter(([l, v]) => l && (v === null || v === "")).map(([l]) => l);

  return (
    <section className="card stack" aria-label="Complaint details">
      <h2>Details</h2>
      <Group title="Complaint" items={complaint} />
      <Group title="Complainant" items={complainant} />
      <Group title="Classification" items={classification} />
      <Group title="Progress and outcome" items={outcome.filter(([l]) => l)} />
      {empty.length > 0 && <p className="small muted">Not recorded yet: {empty.join(", ")}.</p>}
      {children}
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
