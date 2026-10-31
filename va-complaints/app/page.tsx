import Link from "next/link";
import { Rag } from "@/components/Rag";
import { can } from "@/lib/auth/roles";
import { requirePageUser } from "@/lib/auth/session";
import { buildView, type DashboardFilters, filterViews, kpis, sortByRisk } from "@/lib/complaints/view";
import { createUserClient } from "@/lib/db/client";
import { listComplaints } from "@/lib/db/complaints";
import { loadContext } from "@/lib/db/context";
import { type ComplaintStatus, STATUS_LABELS, STATUSES } from "@/lib/domain/complaint";
import { formatDate, formatPercent } from "@/lib/format";
import { type Rag as RagValue, todayUtc } from "@/lib/rules";
import styles from "./dashboard.module.css";

type Search = Record<string, string | string[] | undefined>;

function one(value: string | string[] | undefined): string | undefined {
  const v = Array.isArray(value) ? value[0] : value;
  return v ? v : undefined;
}

function parseFilters(s: Search): DashboardFilters {
  const status = one(s.status);
  const rag = one(s.rag);
  const vulnerable = one(s.vulnerable);
  return {
    search: one(s.q)?.slice(0, 100),
    status: STATUSES.includes(status as ComplaintStatus) ? (status as ComplaintStatus) : undefined,
    insurerId: one(s.insurer),
    handlerId: one(s.handler),
    rag: rag === "red" || rag === "amber" || rag === "green" ? (rag as RagValue) : undefined,
    product: one(s.product),
    vulnerable: vulnerable === "yes" ? true : vulnerable === "no" ? false : undefined,
  };
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<Search> }) {
  const user = await requirePageUser();
  const params = await searchParams;
  const filters = parseFilters(params);
  const db = await createUserClient();
  const [ctx, complaints] = await Promise.all([loadContext(db), listComplaints(db)]);
  const today = todayUtc();
  const all = complaints.map((c) => buildView(c, ctx, today));
  const shown = sortByRisk(filterViews(all, filters));
  const k = kpis(all);
  const filtered = Object.values(filters).some((v) => v !== undefined);

  return (
    <div className="stack">
      <div className="page-header">
        <h1>Dashboard</h1>
        {can.writeComplaints(user.role) && (
          <Link className="button-primary" href="/register">
            Register a complaint
          </Link>
        )}
      </div>

      <section className={styles.tiles} aria-label="Key figures">
        <Tile label="Open" value={k.open} />
        <Tile label="Breaching or overdue" value={k.breaching} tone={k.breaching > 0 ? "alert" : undefined} />
        <Tile label="Due within 7 days" value={k.dueWithin7Days} />
        <Tile label="Resolved or closed" value={k.resolvedOrClosed} />
        <Tile label="Upheld rate" value={formatPercent(k.upheldRate)} />
      </section>

      <form className={`card ${styles.filters}`} method="get" role="search" aria-label="Filter complaints">
        <div className="field">
          <label htmlFor="q">Search</label>
          <input id="q" name="q" type="search" defaultValue={filters.search ?? ""} placeholder="Reference, name or claim reference" />
        </div>
        <Select name="status" label="Status" value={filters.status} options={STATUSES.map((s) => [s, STATUS_LABELS[s]])} />
        <Select name="insurer" label="Complaint type" value={filters.insurerId} options={ctx.insurers.map((i) => [i.id, i.name])} />
        <Select name="handler" label="Handler" value={filters.handlerId} options={ctx.profiles.filter((p) => p.role !== "compliance").map((p) => [p.id, p.display_name])} />
        <Select name="rag" label="RAG" value={filters.rag} options={[["red", "Red"], ["amber", "Amber"], ["green", "Green"]]} />
        <Select name="product" label="Product" value={filters.product} options={ctx.refs.ref_product.map((r) => [r.code, r.label])} />
        <Select name="vulnerable" label="Vulnerable" value={filters.vulnerable === undefined ? undefined : filters.vulnerable ? "yes" : "no"} options={[["yes", "Yes"], ["no", "No"]]} />
        <div className={styles.filterButtons}>
          <button type="submit" className="button-primary">
            Apply
          </button>
          {filtered && (
            <Link href="/" className="button-secondary">
              Clear
            </Link>
          )}
        </div>
      </form>

      <p className="muted small">
        {shown.length} of {all.length} complaints, most at risk first.
      </p>

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th scope="col">Reference</th>
              <th scope="col">RAG</th>
              <th scope="col">Status</th>
              <th scope="col">Complainant</th>
              <th scope="col">Complaint type</th>
              <th scope="col">Handler</th>
              <th scope="col">Received</th>
              <th scope="col">Final response due</th>
              <th scope="col">Days left</th>
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 && (
              <tr>
                <td colSpan={9} className="muted">
                  {all.length === 0 ? "No complaints registered yet." : "No complaints match these filters."}
                </td>
              </tr>
            )}
            {shown.map(({ complaint: c, timeline: t, insurerName, handlerName }) => (
              <tr key={c.id}>
                <td>
                  <Link href={`/complaints/${c.id}`}>{c.reference}</Link>
                  {c.vulnerable_customer && <span className="badge badge-rose"> Vulnerable</span>}
                </td>
                <td>
                  <Rag value={t.rag} />
                </td>
                <td>{STATUS_LABELS[c.status]}</td>
                <td>{c.complainant_name}</td>
                <td>{insurerName}</td>
                <td>{handlerName}</td>
                <td>{formatDate(c.received_date)}</td>
                <td>{formatDate(t.finalResponseDeadline)}</td>
                <td className="num">{t.finalResponseSent || t.summaryResolved ? "Resolved" : t.daysToDeadline}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Tile({ label, value, tone }: { label: string; value: number | string; tone?: "alert" }) {
  return (
    <div className={`${styles.tile} ${tone === "alert" ? styles.alert : ""}`}>
      <span className={styles.value}>{value}</span>
      <span className={styles.label}>{label}</span>
    </div>
  );
}

function Select({ name, label, value, options }: { name: string; label: string; value?: string; options: [string, string][] }) {
  return (
    <div className="field">
      <label htmlFor={name}>{label}</label>
      <select id={name} name={name} defaultValue={value ?? ""}>
        <option value="">All</option>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </div>
  );
}
