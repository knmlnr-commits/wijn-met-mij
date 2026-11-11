import Link from "next/link";
import { Rag } from "@/components/Rag";
import { can } from "@/lib/auth/roles";
import { requirePageUser } from "@/lib/auth/session";
import { nextStep } from "@/lib/complaints/next-step";
import { buildView, type ComplaintView, type DashboardFilters, filterViews, isOpen, kpis, sortByRisk } from "@/lib/complaints/view";
import { createUserClient } from "@/lib/db/client";
import { listComplaints } from "@/lib/db/complaints";
import { loadContext } from "@/lib/db/context";
import { type ComplaintStatus, STATUS_LABELS, STATUSES } from "@/lib/domain/complaint";
import { formatDate, formatPercent } from "@/lib/format";
import { type Rag as RagValue, todayUtc } from "@/lib/rules";
import styles from "./dashboard.module.css";

type Search = Record<string, string | string[] | undefined>;

const VIEWS = ["attention", "open", "due", "done", "all"] as const;
type View = (typeof VIEWS)[number];

const VIEW_LABELS: Record<View, string> = {
  attention: "Needs attention",
  open: "Open",
  due: "Due within 7 days",
  done: "Resolved and closed",
  all: "All",
};

function inView(v: ComplaintView, view: View): boolean {
  const c = v.complaint;
  switch (view) {
    case "attention":
      return c.status !== "closed" && v.timeline.rag !== "green";
    case "open":
      return isOpen(c);
    case "due":
      return isOpen(c) && v.timeline.daysToDeadline >= 0 && v.timeline.daysToDeadline <= 7;
    case "done":
      return !isOpen(c);
    case "all":
      return true;
  }
}

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

function deadlineText(v: ComplaintView): string {
  const t = v.timeline;
  if (t.summaryResolved || t.finalResponseSent) return t.finalResponseLate ? "Answered late" : "Answered in time";
  if (t.daysToDeadline < 0) return `${-t.daysToDeadline} days over`;
  if (t.daysToDeadline === 0) return "Due today";
  return `${t.daysToDeadline} days left`;
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<Search> }) {
  const user = await requirePageUser();
  const params = await searchParams;
  const filters = parseFilters(params);
  const requested = one(params.view) as View | undefined;
  const view: View = requested && VIEWS.includes(requested) ? requested : "open";
  const mine = one(params.mine) === "1";
  const db = await createUserClient();
  const [ctx, complaints] = await Promise.all([loadContext(db), listComplaints(db)]);
  const today = todayUtc();
  const all = complaints.map((c) => buildView(c, ctx, today));
  const scoped = mine ? all.filter((v) => v.complaint.handler_id === user.id) : all;
  const shown = sortByRisk(filterViews(scoped.filter((v) => inView(v, view)), filters));
  const k = kpis(scoped);
  const moreFilters = [filters.status, filters.insurerId, filters.handlerId, filters.rag, filters.product, filters.vulnerable].some((v) => v !== undefined);
  const filtered = moreFilters || filters.search !== undefined;
  const href = (v: View, extra = "") => `/?view=${v}${mine ? "&mine=1" : ""}${extra}`;

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
        <Tile label="Open" value={k.open} href={href("open")} />
        <Tile label="Breaching or overdue" value={k.breaching} tone={k.breaching > 0 ? "alert" : undefined} href={href("all", "&rag=red")} />
        <Tile label="Due within 7 days" value={k.dueWithin7Days} href={href("due")} />
        <Tile label="Resolved or closed" value={k.resolvedOrClosed} href={href("done")} />
        <Tile label="Upheld rate" value={formatPercent(k.upheldRate)} href="/reports" />
      </section>

      <div className={styles.toolbar}>
        <nav className={styles.tabs} aria-label="Views">
          {(["attention", "open", "done", "all"] as const).map((v) => (
            <Link key={v} href={href(v)} className={view === v ? styles.activeTab : undefined} aria-current={view === v ? "page" : undefined}>
              {VIEW_LABELS[v]} <span className={styles.count}>{scoped.filter((x) => inView(x, v)).length}</span>
            </Link>
          ))}
        </nav>
        <Link href={`/?view=${view}${mine ? "" : "&mine=1"}`} className={`${styles.toggle} ${mine ? styles.toggleOn : ""}`} aria-pressed={mine}>
          {mine ? "Showing my complaints" : "Show only my complaints"}
        </Link>
      </div>

      <form className={`card ${styles.filters}`} method="get" role="search" aria-label="Filter complaints">
        <input type="hidden" name="view" value={view} />
        {mine && <input type="hidden" name="mine" value="1" />}
        <div className={styles.searchRow}>
          <div className="field">
            <label htmlFor="q">Search</label>
            <input id="q" name="q" type="search" defaultValue={filters.search ?? ""} placeholder="Reference, name or claim reference" />
          </div>
          <button type="submit" className="button-primary">
            Search
          </button>
          {filtered && (
            <Link href={href(view)} className="button-secondary">
              Clear
            </Link>
          )}
        </div>
        <details open={moreFilters}>
          <summary>More filters</summary>
          <div className={styles.filterGrid}>
            <Select name="status" label="Status" value={filters.status} options={STATUSES.map((s) => [s, STATUS_LABELS[s]])} />
            <Select name="insurer" label="Complaint type" value={filters.insurerId} options={ctx.insurers.map((i) => [i.id, i.name])} />
            <Select name="handler" label="Handler" value={filters.handlerId} options={ctx.profiles.filter((p) => p.role !== "compliance").map((p) => [p.id, p.display_name])} />
            <Select name="rag" label="RAG" value={filters.rag} options={[["red", "Red"], ["amber", "Amber"], ["green", "Green"]]} />
            {ctx.refs.ref_product.length > 0 && <Select name="product" label="Product" value={filters.product} options={ctx.refs.ref_product.map((r) => [r.code, r.label])} />}
            <Select name="vulnerable" label="Vulnerable" value={filters.vulnerable === undefined ? undefined : filters.vulnerable ? "yes" : "no"} options={[["yes", "Yes"], ["no", "No"]]} />
            <div className={styles.filterButtons}>
              <button type="submit" className="button-secondary">
                Apply filters
              </button>
            </div>
          </div>
        </details>
      </form>

      <p className="muted small">
        {VIEW_LABELS[view]}: {shown.length} {shown.length === 1 ? "complaint" : "complaints"}, most at risk first.
      </p>

      <div className="table-wrap">
        <table className={`data ${styles.list}`}>
          <thead>
            <tr>
              <th scope="col">Complaint</th>
              <th scope="col">RAG</th>
              <th scope="col">Next step</th>
              <th scope="col" className={styles.wide}>Complaint type</th>
              <th scope="col" className={styles.wide}>Handler</th>
              <th scope="col" className={styles.wide}>Received</th>
              <th scope="col">Deadline</th>
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 && (
              <tr>
                <td colSpan={7} className="muted">
                  {all.length === 0 ? "No complaints registered yet." : view === "attention" && !filtered ? "Nothing needs attention right now." : "No complaints match this view."}
                </td>
              </tr>
            )}
            {shown.map((v) => {
              const { complaint: c, timeline: t } = v;
              const step = nextStep(c, t);
              return (
                <tr key={c.id}>
                  <td>
                    <Link href={`/complaints/${c.id}`} className={styles.ref}>
                      {c.reference}
                    </Link>
                    <div className="small">{c.complainant_name}</div>
                    {c.vulnerable_customer && <span className="badge badge-rose">Vulnerable</span>}
                  </td>
                  <td>
                    <Rag value={t.rag} />
                  </td>
                  <td className={styles.step}>
                    <span className={step.tone === "urgent" ? styles.urgent : undefined}>{step.title}</span>
                    <div className="small muted">{STATUS_LABELS[c.status]}</div>
                  </td>
                  <td className={styles.wide}>{v.insurerName}</td>
                  <td className={styles.wide}>{v.handlerName}</td>
                  <td className={styles.wide}>{formatDate(c.received_date)}</td>
                  <td>
                    {formatDate(t.finalResponseDeadline)}
                    <div className="small muted">{deadlineText(v)}</div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Tile({ label, value, tone, href }: { label: string; value: number | string; tone?: "alert"; href: string }) {
  return (
    <Link href={href} className={`${styles.tile} ${tone === "alert" ? styles.alert : ""}`}>
      <span className={styles.value}>{value}</span>
      <span className={styles.label}>{label}</span>
    </Link>
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
