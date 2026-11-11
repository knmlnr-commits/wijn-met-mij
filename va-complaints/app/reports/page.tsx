import type { Metadata } from "next";
import Link from "next/link";
import { requirePageUser } from "@/lib/auth/session";
import { createUserClient } from "@/lib/db/client";
import { listBankHolidays } from "@/lib/db/settings";
import { formatDate, formatGBP, formatPercent } from "@/lib/format";
import { loadMiReport, reportPeriod } from "@/lib/reports/load";
import { deadlineStatus, insurerFilterLabel, type MiReport, ucrDueDate } from "@/lib/reports/mi";
import { holidayDates, UCR_DUE_BUSINESS_DAYS, UCR_START_DATE } from "@/lib/rules";
import { BarList } from "./charts/BarList";
import { StackedBar, type Tone } from "./charts/StackedBar";
import { TrendChart } from "./charts/TrendChart";
import { InsurerFilter } from "./InsurerFilter";
import styles from "./reports.module.css";

export const metadata: Metadata = { title: "Reports | Van Ameyde Complaints Management" };

const OUTCOME_TONES: Record<string, Tone> = { Upheld: "navy", "Partially upheld": "navyLight", "Not upheld": "rose" };
const STATUS_TEXT = { good: "Good: 95% or more", warning: "Warning: 85% to 95%", alert: "Alert: below 85%" } as const;

function query(from: string, to: string, insurers: readonly string[]): string {
  const q = new URLSearchParams({ from, to });
  if (insurers.length > 0) q.set("insurer", insurers.join(","));
  return q.toString();
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; insurer?: string | string[] }> }) {
  await requirePageUser();
  const params = await searchParams;
  const { from, to } = reportPeriod(params);
  const db = await createUserClient();
  const [{ report, insurerOptions }, holidays] = await Promise.all([loadMiReport(db, from, to, params.insurer), listBankHolidays(db)]);
  const due = ucrDueDate(to, holidayDates(holidays, true));
  const filtered = report.insurers.length > 0;
  const status = deadlineStatus(report.percentInTime);
  // Outcome parts keep a fixed order (upheld, partially upheld, not upheld), whatever their size.
  const outcomeOrder = Object.keys(OUTCOME_TONES);
  const byOutcome = [...report.byOutcome].sort((a, b) => outcomeOrder.indexOf(a.label) - outcomeOrder.indexOf(b.label));
  const upheldAgainstTones: Record<string, Tone> = Object.fromEntries(
    report.byUpheldAgainst.map((b) => [b.label, b.label === "Insurer" ? "turquoise" : "navy"]),
  );

  return (
    <div className="stack">
      <div className="page-header">
        <h1>Reports</h1>
        <a className="button-secondary" href={`/reports/export?${query(from, to, report.insurers)}`} download>
          Export CSV
        </a>
      </div>

      <form className={`card ${styles.filterBar}`} method="get" aria-label="Report filters">
        <div className="field">
          <label htmlFor="from">Received from</label>
          <input id="from" name="from" type="date" defaultValue={from} />
        </div>
        <div className="field">
          <label htmlFor="to">Received to</label>
          <input id="to" name="to" type="date" defaultValue={to} />
        </div>
        <InsurerFilter key={report.insurers.join(",")} options={insurerOptions} selected={report.insurers} />
        <button type="submit" className="button-primary">
          Update report
        </button>
      </form>

      <div className={styles.periodHeading}>
        <h2 id="summary-heading">
          Complaints received {formatDate(from)} to {formatDate(to)}; {insurerFilterLabel(report.insurers)}
        </h2>
        {filtered && <Link href={`/reports?${query(from, to, [])}`}>Clear filters</Link>}
      </div>

      {report.received === 0 ? (
        <section className={`card ${styles.empty}`} aria-labelledby="summary-heading">
          <p>No complaints for this selection</p>
          <span className="muted">Choose a longer period or another insurer.</span>
        </section>
      ) : (
        <>
          <section className={styles.tiles} aria-labelledby="summary-heading">
            <Tile label="Complaints received" value={report.received} />
            <Tile label="Open at period end" value={report.openAtPeriodEnd} />
            <div className={`${styles.tile} ${styles.tileHighlight} ${status ? styles[`tile_${status}`] : ""}`}>
              <span className={styles.tileLabel}>Final responses within deadline</span>
              <span className={styles.tileValue}>{formatPercent(report.percentInTime)}</span>
              {status ? (
                <span className={`${styles.status} ${styles[`status_${status}`]}`}>{STATUS_TEXT[status]}</span>
              ) : (
                <span className={styles.tileNote}>No final responses yet</span>
              )}
              <span className={styles.tileNote}>
                {report.finalResponsesInTime} of {report.finalResponses} final responses
              </span>
            </div>
            <div className={`${styles.tile} ${styles.tileHighlight}`}>
              <span className={styles.tileLabel}>Upheld rate</span>
              <span className={styles.tileValue}>{formatPercent(report.upheldRate)}</span>
              <span className={styles.tileNote}>Upheld or partially upheld, of complaints with an outcome</span>
            </div>
            <Tile label="Resolved" value={report.resolved} />
            <Tile label="Summary resolutions (DISP 1.5)" value={report.summaryResolutions} />
            <Tile label="Average days to final response" value={report.averageDaysToFinalResponse ?? "Not applicable"} />
            <Tile label="Acknowledgements late or overdue" value={report.acknowledgementsLate} />
            <Tile label="Total compensation" value={formatGBP(report.totalCompensation)} />
            <Tile label="Compensation outstanding" value={report.compensationOutstanding} />
            <Tile label="Vulnerable customers" value={report.vulnerable} />
            <Tile label="Final responses" value={report.finalResponses} />
          </section>

          <section className="card stack" aria-labelledby="trend-heading">
            <h2 id="trend-heading">Monthly trend</h2>
            <TrendChart points={report.trend} />
          </section>

          {report.comparison.length > 0 && <Comparison report={report} />}

          <div className={styles.cards}>
            <Card title="By insurer" note={filtered ? undefined : "Select an insurer to filter the report on it."}>
              <BarList rows={report.byInsurer} hrefFor={(label) => `/reports?${query(from, to, [label])}`} />
            </Card>
            <Card title="By product">
              <BarList rows={report.byProduct} />
            </Card>
            <Card title="By nature of complaint">
              <BarList rows={report.byNature} />
            </Card>
            <Card title="By root cause">
              <BarList rows={report.byRootCause} />
            </Card>
            <Card title="By outcome" note="Complaints with an outcome.">
              <StackedBar rows={byOutcome} tones={OUTCOME_TONES} label="Outcome" />
            </Card>
            <Card title="Upheld against" note="Upheld and partially upheld complaints.">
              <StackedBar rows={report.byUpheldAgainst} tones={upheldAgainstTones} label="Upheld against" />
            </Card>
          </div>
        </>
      )}

      <p className="notice small">
        <strong>PS25/19 Unified Complaints Return.</strong> From {formatDate(UCR_START_DATE)} the FCA replaces the previous complaints returns with
        one return at entity level, due within {UCR_DUE_BUSINESS_DAYS} business days of the end of the reporting period. For a period ending{" "}
        {formatDate(to)} that is {formatDate(due)}. This page gives the underlying DISP 1.10 management information; the return file itself is not
        part of this release.
      </p>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className={styles.tile}>
      <span className={styles.tileLabel}>{label}</span>
      <span className={styles.tileValue}>{value}</span>
    </div>
  );
}

function Card({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="card stack">
      <div>
        <h2>{title}</h2>
        {note && <p className="muted small">{note}</p>}
      </div>
      {children}
    </section>
  );
}

function Comparison({ report }: { report: MiReport }) {
  return (
    <section className="card stack" aria-labelledby="comparison-heading">
      <h2 id="comparison-heading">Insurer comparison</h2>
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th scope="col">Insurer</th>
              <th scope="col" className="num">Received</th>
              <th scope="col" className="num">Open</th>
              <th scope="col" className="num">Within deadline</th>
              <th scope="col" className="num">Average days to final response</th>
              <th scope="col" className="num">Upheld rate</th>
              <th scope="col" className="num">Compensation</th>
            </tr>
          </thead>
          <tbody>
            {report.comparison.map((c) => {
              const s = deadlineStatus(c.percentInTime);
              return (
                <tr key={c.insurer}>
                  <th scope="row">{c.insurer}</th>
                  <td className="num">{c.received}</td>
                  <td className="num">{c.openAtPeriodEnd}</td>
                  <td className="num">
                    {s ? <span className={`${styles.status} ${styles[`status_${s}`]}`}>{formatPercent(c.percentInTime)}</span> : formatPercent(c.percentInTime)}
                  </td>
                  <td className="num">{c.averageDaysToFinalResponse ?? "Not applicable"}</td>
                  <td className="num">{formatPercent(c.upheldRate)}</td>
                  <td className="num">{formatGBP(c.totalCompensation)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
