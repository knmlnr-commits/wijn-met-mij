import type { Metadata } from "next";
import { requirePageUser } from "@/lib/auth/session";
import { createUserClient } from "@/lib/db/client";
import { listBankHolidays } from "@/lib/db/settings";
import { formatDate, formatGBP, formatPercent } from "@/lib/format";
import { loadMiReport, reportPeriod } from "@/lib/reports/load";
import { type Breakdown, ucrDueDate } from "@/lib/reports/mi";
import { holidayDates, UCR_DUE_BUSINESS_DAYS, UCR_START_DATE } from "@/lib/rules";

export const metadata: Metadata = { title: "Reports | Van Ameyde Complaints Management" };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  await requirePageUser();
  const params = await searchParams;
  const { from, to } = reportPeriod(params);
  const db = await createUserClient();
  const [report, holidays] = await Promise.all([loadMiReport(db, from, to), listBankHolidays(db)]);
  const due = ucrDueDate(to, holidayDates(holidays, true));

  return (
    <div className="stack">
      <div className="page-header">
        <h1>Reports</h1>
        <a className="button-secondary" href={`/reports/export?from=${from}&to=${to}`} download>
          Export CSV
        </a>
      </div>

      <form className="card form-grid" method="get" aria-label="Report period">
        <div className="field">
          <label htmlFor="from">Received from</label>
          <input id="from" name="from" type="date" defaultValue={from} />
        </div>
        <div className="field">
          <label htmlFor="to">Received to</label>
          <input id="to" name="to" type="date" defaultValue={to} />
        </div>
        <div className="button-row full">
          <button type="submit" className="button-primary">
            Update report
          </button>
        </div>
      </form>

      <p className="notice small">
        <strong>PS25/19 Unified Complaints Return.</strong> From {formatDate(UCR_START_DATE)} the FCA replaces the previous complaints returns with
        one return at entity level, due within {UCR_DUE_BUSINESS_DAYS} business days of the end of the reporting period. For a period ending{" "}
        {formatDate(to)} that is {formatDate(due)}. This page gives the underlying DISP 1.10 management information; the return file itself is not
        part of this release.
      </p>

      <section className="card stack" aria-labelledby="summary-heading">
        <h2 id="summary-heading">
          Complaints received {formatDate(from)} to {formatDate(to)}
        </h2>
        <div className="table-wrap">
          <table className="data">
            <tbody>
              <Row label="Complaints received" value={report.received} />
              <Row label="Resolved" value={report.resolved} />
              <Row label="Open at period end" value={report.openAtPeriodEnd} />
              <Row label="Summary resolutions (DISP 1.5)" value={report.summaryResolutions} />
              <Row label="Final responses" value={report.finalResponses} />
              <Row label="Final responses within deadline" value={report.finalResponsesInTime} />
              <Row label="Percent within deadline" value={formatPercent(report.percentInTime)} />
              <Row label="Average days to final response" value={report.averageDaysToFinalResponse ?? "Not applicable"} />
              <Row label="Total compensation" value={formatGBP(report.totalCompensation)} />
              <Row label="Vulnerable customers" value={report.vulnerable} />
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid-2">
        <BreakdownTable title="By insurer" rows={report.byInsurer} />
        <BreakdownTable title="By product" rows={report.byProduct} />
        <BreakdownTable title="By nature of complaint" rows={report.byNature} />
        <BreakdownTable title="By root cause" rows={report.byRootCause} />
        <BreakdownTable title="By outcome" rows={report.byOutcome} />
        <BreakdownTable title="Upheld against" rows={report.byUpheldAgainst} />
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <tr>
      <th scope="row">{label}</th>
      <td className="num">{value}</td>
    </tr>
  );
}

function BreakdownTable({ title, rows }: { title: string; rows: Breakdown[] }) {
  return (
    <section className="card stack">
      <h2>{title}</h2>
      {rows.length === 0 ? (
        <p className="muted">No complaints in this period.</p>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <tbody>
              {rows.map((r) => (
                <Row key={r.label} label={r.label} value={r.count} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
