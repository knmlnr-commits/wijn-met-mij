import type { ComplaintView } from "@/lib/complaints/view";
import { OUTCOME_LABELS } from "@/lib/domain/complaint";
import { addBusinessDays, addDays, daysBetween, type IsoDate, isAfter, UCR_DUE_BUSINESS_DAYS } from "@/lib/rules";

/**
 * DISP 1.10 management information over complaints received in a date range. Whether a final
 * response was in time is judged per complaint by the rules engine, so each insurer's own
 * profile applies (build 38a7212 used a fixed 56 days).
 */

export interface Breakdown {
  label: string;
  count: number;
  /** Share of the breakdown total, in percent with one decimal. */
  percent: number;
}

/** The core measures; used for the whole selection and for each insurer in a comparison. */
export interface MiMeasures {
  received: number;
  resolved: number;
  openAtPeriodEnd: number;
  summaryResolutions: number;
  acknowledgementsLate: number;
  finalResponses: number;
  finalResponsesInTime: number;
  percentInTime: number | null;
  averageDaysToFinalResponse: number | null;
  totalCompensation: number;
  upheldRate: number | null;
  compensationOutstanding: number;
  vulnerable: number;
}

export interface InsurerComparison extends MiMeasures {
  insurer: string;
}

export interface TrendPoint {
  /** Month as yyyy-mm. */
  month: string;
  received: number;
  finalResponses: number;
  /** Of the complaints received in the month that have a final response: percent within deadline. */
  percentInTime: number | null;
}

export interface MiReport extends MiMeasures {
  from: IsoDate;
  to: IsoDate;
  /** Insurers the report is limited to; empty means all insurers. */
  insurers: string[];
  /** One row per selected insurer, filled when two or more are selected. */
  comparison: InsurerComparison[];
  trend: TrendPoint[];
  byInsurer: Breakdown[];
  byProduct: Breakdown[];
  byNature: Breakdown[];
  byRootCause: Breakdown[];
  byOutcome: Breakdown[];
  byUpheldAgainst: Breakdown[];
}

/** Upheld or partially upheld, as a percentage of complaints with an outcome; null when none. One definition for every screen. */
export function upheldRate(views: ComplaintView[]): number | null {
  const withOutcome = views.filter((v) => v.complaint.outcome !== null);
  if (withOutcome.length === 0) return null;
  return Math.round((1000 * withOutcome.filter((v) => v.complaint.outcome !== "not_upheld").length) / withOutcome.length) / 10;
}

export function receivedInPeriod(views: ComplaintView[], from: IsoDate, to: IsoDate): ComplaintView[] {
  return views.filter((v) => !isAfter(from, v.complaint.received_date) && !isAfter(v.complaint.received_date, to));
}

/** The default reporting period on every screen: the 12 months up to today. */
export function defaultPeriod(today: IsoDate): { from: IsoDate; to: IsoDate } {
  return { from: addDays(today, -364), to: today };
}

export interface MiLabels {
  product: Map<string, string>;
  nature: Map<string, string>;
  rootCause: Map<string, string>;
  firmShortName: string;
}

export const NOT_RECORDED = "Not recorded";
export const ALL_INSURERS = "All insurers";

const round1 = (n: number) => Math.round(10 * n) / 10;

/** Counts per label, largest first, "Not recorded" always last. */
function breakdown(values: (string | null)[]): Breakdown[] {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v ?? NOT_RECORDED, (counts.get(v ?? NOT_RECORDED) ?? 0) + 1);
  const total = values.length;
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count, percent: round1((100 * count) / total) }))
    .sort(
      (a, b) =>
        Number(a.label === NOT_RECORDED) - Number(b.label === NOT_RECORDED) || b.count - a.count || a.label.localeCompare(b.label),
    );
}

function percentInTime(views: ComplaintView[]): number | null {
  const finals = views.filter((v) => v.complaint.final_response_date !== null);
  return finals.length === 0 ? null : round1((100 * finals.filter((v) => !v.timeline.finalResponseLate).length) / finals.length);
}

function measures(inRange: ComplaintView[], to: IsoDate): MiMeasures {
  const finals = inRange.filter((v) => v.complaint.final_response_date !== null);
  const durations = finals.map((v) => daysBetween(v.complaint.received_date, v.complaint.final_response_date as IsoDate));
  return {
    received: inRange.length,
    resolved: inRange.filter((v) => v.complaint.resolution_path !== null).length,
    openAtPeriodEnd: inRange.filter((v) => {
      const c = v.complaint;
      if (c.resolution_path === "summary_resolution") return false;
      return c.final_response_date === null || isAfter(c.final_response_date, to);
    }).length,
    summaryResolutions: inRange.filter((v) => v.complaint.resolution_path === "summary_resolution").length,
    acknowledgementsLate: inRange.filter((v) => v.timeline.acknowledgementLate || v.timeline.acknowledgementOverdue).length,
    finalResponses: finals.length,
    finalResponsesInTime: finals.filter((v) => !v.timeline.finalResponseLate).length,
    percentInTime: percentInTime(inRange),
    averageDaysToFinalResponse: durations.length === 0 ? null : round1(durations.reduce((a, b) => a + b, 0) / durations.length),
    totalCompensation: Math.round(100 * inRange.reduce((sum, v) => sum + Number(v.complaint.compensation_amount ?? 0), 0)) / 100,
    upheldRate: upheldRate(inRange),
    compensationOutstanding: inRange.filter((v) => v.complaint.status === "compensation_outstanding").length,
    vulnerable: inRange.filter((v) => v.complaint.vulnerable_customer).length,
  };
}

/** Every calendar month from the start to the end of the period, with the complaints received in it. */
function monthlyTrend(inRange: ComplaintView[], from: IsoDate, to: IsoDate): TrendPoint[] {
  const points: TrendPoint[] = [];
  let year = Number(from.slice(0, 4));
  let month = Number(from.slice(5, 7));
  const last = to.slice(0, 7);
  for (;;) {
    const key = `${year}-${String(month).padStart(2, "0")}`;
    const inMonth = inRange.filter((v) => v.complaint.received_date.startsWith(key));
    points.push({
      month: key,
      received: inMonth.length,
      finalResponses: inMonth.filter((v) => v.complaint.final_response_date !== null).length,
      percentInTime: percentInTime(inMonth),
    });
    if (key >= last) break;
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return points;
}

/** Insurer names present in the data, alphabetically; the options of the insurer filter. */
export function insurerOptions(views: ComplaintView[]): string[] {
  return [...new Set(views.map((v) => v.insurerName))].sort((a, b) => a.localeCompare(b));
}

/**
 * Reads the insurer filter from its query value ("Zurich,AXA"). Unknown names are dropped; no
 * names, or every name, means all insurers and gives an empty list.
 */
export function parseInsurerFilter(value: string | string[] | null | undefined, options: readonly string[]): string[] {
  const asked = (Array.isArray(value) ? value : [value ?? ""]).flatMap((v) => v.split(",")).map((v) => v.trim().toLowerCase());
  const chosen = options.filter((o) => asked.includes(o.toLowerCase()));
  return chosen.length === options.length ? [] : chosen;
}

/** The filter as text for headings and the export: "All insurers" or the names. */
export function insurerFilterLabel(insurers: readonly string[]): string {
  return insurers.length === 0 ? ALL_INSURERS : insurers.join(", ");
}

export function buildMiReport(
  views: ComplaintView[],
  from: IsoDate,
  to: IsoDate,
  labels: MiLabels,
  insurers: readonly string[] = [],
): MiReport {
  const selected = insurers.length === 0 ? views : views.filter((v) => insurers.includes(v.insurerName));
  const inRange = receivedInPeriod(selected, from, to);
  const lookup = (map: Map<string, string>, code: string | null) => (code ? (map.get(code) ?? code) : null);

  return {
    from,
    to,
    insurers: [...insurers],
    ...measures(inRange, to),
    comparison:
      insurers.length < 2
        ? []
        : insurers.map((insurer) => ({ insurer, ...measures(inRange.filter((v) => v.insurerName === insurer), to) })),
    trend: monthlyTrend(inRange, from, to),
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

/** Thresholds for the share of final responses within deadline. */
export const DEADLINE_GOOD_PERCENT = 95;
export const DEADLINE_WARNING_PERCENT = 85;

export function deadlineStatus(percent: number | null): "good" | "warning" | "alert" | null {
  if (percent === null) return null;
  if (percent >= DEADLINE_GOOD_PERCENT) return "good";
  return percent >= DEADLINE_WARNING_PERCENT ? "warning" : "alert";
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

/** File name of the export; carries the period and the insurer filter. */
export function miReportFileName(r: Pick<MiReport, "from" | "to" | "insurers">): string {
  const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const insurers = r.insurers.length === 0 ? "all-insurers" : r.insurers.map(slug).join("-");
  return `complaints-mi-${r.from}-to-${r.to}-${insurers}.csv`;
}

export function miReportCsv(r: MiReport): string {
  const rows: [string, string | number | null][] = [
    ["Insurers", insurerFilterLabel(r.insurers)],
    ["Period from", r.from],
    ["Period to", r.to],
    ["Complaints received", r.received],
    ["Resolved", r.resolved],
    ["Open at period end", r.openAtPeriodEnd],
    ["Summary resolutions", r.summaryResolutions],
    ["Acknowledgements late or overdue", r.acknowledgementsLate],
    ["Final responses", r.finalResponses],
    ["Final responses within deadline", r.finalResponsesInTime],
    ["Percent within deadline", r.percentInTime],
    ["Average days to final response", r.averageDaysToFinalResponse],
    ["Upheld rate (percent; upheld or partially upheld, of complaints with an outcome)", r.upheldRate],
    ["Total compensation (GBP)", r.totalCompensation.toFixed(2)],
    ["Compensation outstanding", r.compensationOutstanding],
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
  // First row: what the file covers, including the insurer filter. Second row: the column names.
  const lines = [
    [csvCell("Complaints MI"), csvCell(`${r.from} to ${r.to}`), csvCell(`Insurers: ${insurerFilterLabel(r.insurers)}`)].join(","),
    "Measure,Category,Value",
    ...rows.map(([m, v]) => `${csvCell(m)},,${csvCell(v)}`),
  ];
  for (const [name, items] of groups) for (const b of items) lines.push(`${csvCell(name)},${csvCell(b.label)},${b.count}`);
  for (const c of r.comparison) {
    lines.push(`${csvCell("Insurer comparison: received")},${csvCell(c.insurer)},${c.received}`);
    lines.push(`${csvCell("Insurer comparison: open at period end")},${csvCell(c.insurer)},${c.openAtPeriodEnd}`);
    lines.push(`${csvCell("Insurer comparison: percent within deadline")},${csvCell(c.insurer)},${csvCell(c.percentInTime)}`);
    lines.push(`${csvCell("Insurer comparison: average days to final response")},${csvCell(c.insurer)},${csvCell(c.averageDaysToFinalResponse)}`);
    lines.push(`${csvCell("Insurer comparison: upheld rate")},${csvCell(c.insurer)},${csvCell(c.upheldRate)}`);
    lines.push(`${csvCell("Insurer comparison: compensation (GBP)")},${csvCell(c.insurer)},${c.totalCompensation.toFixed(2)}`);
  }
  for (const t of r.trend) lines.push(`${csvCell("Received per month")},${t.month},${t.received}`);
  return `${lines.join("\r\n")}\r\n`;
}
