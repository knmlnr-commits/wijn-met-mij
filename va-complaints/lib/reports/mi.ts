import type { ComplaintView } from "@/lib/complaints/view";
import { OUTCOME_LABELS } from "@/lib/domain/complaint";
import { addBusinessDays, daysBetween, type IsoDate, isAfter, UCR_DUE_BUSINESS_DAYS } from "@/lib/rules";

/**
 * DISP 1.10 management information over complaints received in a date range. Whether a final
 * response was in time is judged per complaint by the rules engine, so each insurer's own
 * profile applies (build 38a7212 used a fixed 56 days).
 */

export interface Breakdown {
  label: string;
  count: number;
}

export interface MiReport {
  from: IsoDate;
  to: IsoDate;
  received: number;
  resolved: number;
  openAtPeriodEnd: number;
  summaryResolutions: number;
  finalResponses: number;
  finalResponsesInTime: number;
  percentInTime: number | null;
  averageDaysToFinalResponse: number | null;
  totalCompensation: number;
  vulnerable: number;
  byInsurer: Breakdown[];
  byProduct: Breakdown[];
  byNature: Breakdown[];
  byRootCause: Breakdown[];
  byOutcome: Breakdown[];
  byUpheldAgainst: Breakdown[];
}

export interface MiLabels {
  product: Map<string, string>;
  nature: Map<string, string>;
  rootCause: Map<string, string>;
  firmShortName: string;
}

const NOT_RECORDED = "Not recorded";

function breakdown(values: (string | null)[]): Breakdown[] {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v ?? NOT_RECORDED, (counts.get(v ?? NOT_RECORDED) ?? 0) + 1);
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

export function buildMiReport(views: ComplaintView[], from: IsoDate, to: IsoDate, labels: MiLabels): MiReport {
  const inRange = views.filter((v) => !isAfter(from, v.complaint.received_date) && !isAfter(v.complaint.received_date, to));
  const finals = inRange.filter((v) => v.complaint.final_response_date !== null);
  const inTime = finals.filter((v) => !v.timeline.finalResponseLate);
  const durations = finals.map((v) => daysBetween(v.complaint.received_date, v.complaint.final_response_date as IsoDate));
  const lookup = (map: Map<string, string>, code: string | null) => (code ? (map.get(code) ?? code) : null);

  return {
    from,
    to,
    received: inRange.length,
    resolved: inRange.filter((v) => v.complaint.resolution_path !== null).length,
    openAtPeriodEnd: inRange.filter((v) => {
      const c = v.complaint;
      if (c.resolution_path === "summary_resolution") return false;
      return c.final_response_date === null || isAfter(c.final_response_date, to);
    }).length,
    summaryResolutions: inRange.filter((v) => v.complaint.resolution_path === "summary_resolution").length,
    finalResponses: finals.length,
    finalResponsesInTime: inTime.length,
    percentInTime: finals.length === 0 ? null : Math.round((1000 * inTime.length) / finals.length) / 10,
    averageDaysToFinalResponse:
      durations.length === 0 ? null : Math.round((10 * durations.reduce((a, b) => a + b, 0)) / durations.length) / 10,
    totalCompensation: Math.round(100 * inRange.reduce((sum, v) => sum + Number(v.complaint.compensation_amount ?? 0), 0)) / 100,
    vulnerable: inRange.filter((v) => v.complaint.vulnerable_customer).length,
    byInsurer: breakdown(inRange.map((v) => v.insurerName)),
    byProduct: breakdown(inRange.map((v) => lookup(labels.product, v.complaint.product))),
    byNature: breakdown(inRange.map((v) => lookup(labels.nature, v.complaint.nature_of_complaint))),
    byRootCause: breakdown(inRange.map((v) => lookup(labels.rootCause, v.complaint.root_cause))),
    byOutcome: breakdown(inRange.filter((v) => v.complaint.outcome).map((v) => OUTCOME_LABELS[v.complaint.outcome!])),
    byUpheldAgainst: breakdown(
      inRange
        .filter((v) => v.complaint.upheld_against)
        .map((v) => (v.complaint.upheld_against === "firm" ? labels.firmShortName : "Insurer")),
    ),
  };
}

/** PS25/19: the Unified Complaints Return is due 30 business days after the period end. */
export function ucrDueDate(periodEnd: IsoDate, holidays: readonly IsoDate[]): IsoDate {
  return addBusinessDays(periodEnd, UCR_DUE_BUSINESS_DAYS, holidays);
}

/** Quotes a CSV cell and neutralises spreadsheet formulas (cells starting with = + - @). */
export function csvCell(value: string | number | null): string {
  if (value === null) return "";
  let text = String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function miReportCsv(r: MiReport): string {
  const rows: [string, string | number | null][] = [
    ["Period from", r.from],
    ["Period to", r.to],
    ["Complaints received", r.received],
    ["Resolved", r.resolved],
    ["Open at period end", r.openAtPeriodEnd],
    ["Summary resolutions", r.summaryResolutions],
    ["Final responses", r.finalResponses],
    ["Final responses within deadline", r.finalResponsesInTime],
    ["Percent within deadline", r.percentInTime],
    ["Average days to final response", r.averageDaysToFinalResponse],
    ["Total compensation (GBP)", r.totalCompensation.toFixed(2)],
    ["Vulnerable customers", r.vulnerable],
  ];
  const groups: [string, Breakdown[]][] = [
    ["Insurer", r.byInsurer],
    ["Product", r.byProduct],
    ["Nature of complaint", r.byNature],
    ["Root cause", r.byRootCause],
    ["Outcome", r.byOutcome],
    ["Upheld against", r.byUpheldAgainst],
  ];
  const lines = ["Measure,Category,Value", ...rows.map(([m, v]) => `${csvCell(m)},,${csvCell(v)}`)];
  for (const [name, items] of groups) for (const b of items) lines.push(`${csvCell(name)},${csvCell(b.label)},${b.count}`);
  return `${lines.join("\r\n")}\r\n`;
}
