import { describe, expect, it } from "vitest";
import {
  buildMiReport,
  deadlineStatus,
  insurerFilterLabel,
  insurerOptions,
  miReportCsv,
  miReportFileName,
  NOT_RECORDED,
  parseInsurerFilter,
} from "@/lib/reports/mi";
import { demoViews } from "./fixtures";

const TODAY = "2026-10-30";
const FROM = "2025-01-01";
const views = demoViews(TODAY);
const labels = { product: new Map(), nature: new Map(), rootCause: new Map(), firmShortName: "Van Ameyde" };
const options = insurerOptions(views);
const report = (insurers: string[] = []) => buildMiReport(views, FROM, TODAY, labels, insurers);
const sum = (rows: { count: number }[]) => rows.reduce((s, r) => s + r.count, 0);

describe("insurer filter", () => {
  it("offers the insurers in the data, alphabetically", () => {
    expect(options.length).toBeGreaterThanOrEqual(3);
    expect(options).toEqual([...options].sort((a, b) => a.localeCompare(b)));
  });

  it("reads the query value, ignores unknown names and treats every insurer as all", () => {
    expect(parseInsurerFilter(undefined, options)).toEqual([]);
    expect(parseInsurerFilter("", options)).toEqual([]);
    expect(parseInsurerFilter(`${options[1]},${options[0]}`, options)).toEqual([options[0], options[1]]);
    expect(parseInsurerFilter(`${options[0].toUpperCase()}, Unknown Insurer`, options)).toEqual([options[0]]);
    expect(parseInsurerFilter("Unknown Insurer", options)).toEqual([]);
    expect(parseInsurerFilter(options.join(","), options)).toEqual([]);
    expect(parseInsurerFilter([options[0], options[2]], options)).toEqual([options[0], options[2]]);
  });

  it("a single insurer limits every figure to that insurer", () => {
    const name = options[0];
    const r = report([name]);
    const expected = views.filter((v) => v.insurerName === name).length;
    expect(expected).toBeGreaterThan(0);
    expect(r.received).toBe(expected);
    expect(r.byInsurer.map((b) => b.label)).toEqual([name]);
    expect(r.byInsurer[0].percent).toBe(100);
    expect(sum(r.byProduct)).toBe(expected);
    expect(r.trend.reduce((s, t) => s + t.received, 0)).toBe(expected);
    expect(r.comparison).toEqual([]);
  });

  it("several insurers add up, and are compared side by side", () => {
    const pair = [options[0], options[1]];
    const r = report(pair);
    const a = report([pair[0]]);
    const b = report([pair[1]]);
    expect(r.received).toBe(a.received + b.received);
    expect(r.finalResponses).toBe(a.finalResponses + b.finalResponses);
    expect(r.totalCompensation).toBeCloseTo(a.totalCompensation + b.totalCompensation, 2);
    expect(r.comparison.map((c) => c.insurer)).toEqual(pair);
    expect(r.comparison[0]).toMatchObject({ received: a.received, openAtPeriodEnd: a.openAtPeriodEnd, percentInTime: a.percentInTime, upheldRate: a.upheldRate });
    expect(r.comparison[1].totalCompensation).toBe(b.totalCompensation);
  });

  it("all insurers is the unfiltered report, and equals the insurers added together", () => {
    const all = report();
    expect(all.insurers).toEqual([]);
    expect(all.received).toBe(25);
    const each = options.map((o) => report([o]));
    for (const key of ["received", "resolved", "openAtPeriodEnd", "summaryResolutions", "finalResponses", "finalResponsesInTime", "vulnerable", "compensationOutstanding", "acknowledgementsLate"] as const) {
      expect(each.reduce((s, r) => s + r[key], 0), key).toBe(all[key]);
    }
  });

  it("an insurer with no complaints in the period gives an empty report, not an error", () => {
    const r = buildMiReport(views, "2020-01-01", "2020-03-31", labels, [options[0]]);
    expect(r.received).toBe(0);
    expect(r.percentInTime).toBeNull();
    expect(r.upheldRate).toBeNull();
    expect(r.byInsurer).toEqual([]);
    expect(r.trend.map((t) => t.month)).toEqual(["2020-01", "2020-02", "2020-03"]);
    expect(miReportCsv(r)).toContain("Complaints received,,0");
  });
});

describe("report figures", () => {
  const r = report();

  it("KPI totals add up", () => {
    expect(sum(r.byInsurer)).toBe(r.received);
    expect(sum(r.byProduct)).toBe(r.received);
    expect(sum(r.byNature)).toBe(r.received);
    expect(sum(r.byRootCause)).toBe(r.received);
    expect(r.trend.reduce((s, t) => s + t.received, 0)).toBe(r.received);
    expect(r.trend.reduce((s, t) => s + t.finalResponses, 0)).toBe(r.finalResponses);
    expect(r.finalResponsesInTime).toBeLessThanOrEqual(r.finalResponses);
    expect(r.openAtPeriodEnd + r.summaryResolutions).toBeLessThanOrEqual(r.received);
    for (const rows of [r.byInsurer, r.byProduct, r.byOutcome]) {
      expect(rows.reduce((s, b) => s + b.percent, 0)).toBeGreaterThan(99.5);
      expect(rows.reduce((s, b) => s + b.percent, 0)).toBeLessThan(100.5);
    }
  });

  it("sorts bars largest first with Not recorded last", () => {
    for (const rows of [r.byInsurer, r.byProduct, r.byNature, r.byRootCause]) {
      const recorded = rows.filter((b) => b.label !== NOT_RECORDED);
      expect(recorded.map((b) => b.count)).toEqual([...recorded.map((b) => b.count)].sort((a, b) => b - a));
      const at = rows.findIndex((b) => b.label === NOT_RECORDED);
      if (at >= 0) expect(at).toBe(rows.length - 1);
    }
  });

  it("gives one trend point per calendar month of the period", () => {
    expect(r.trend[0].month).toBe("2025-01");
    expect(r.trend.at(-1)?.month).toBe("2026-10");
    expect(r.trend.length).toBe(22);
  });

  it("applies the deadline thresholds", () => {
    expect(deadlineStatus(95)).toBe("good");
    expect(deadlineStatus(94.9)).toBe("warning");
    expect(deadlineStatus(85)).toBe("warning");
    expect(deadlineStatus(84.9)).toBe("alert");
    expect(deadlineStatus(null)).toBeNull();
  });
});

describe("CSV export with the insurer filter", () => {
  it("names the filter in the file name", () => {
    expect(miReportFileName(report())).toBe(`complaints-mi-${FROM}-to-${TODAY}-all-insurers.csv`);
    expect(miReportFileName({ from: FROM, to: TODAY, insurers: ["Zurich", "Lloyd's Syndicate 1"] })).toBe(
      `complaints-mi-${FROM}-to-${TODAY}-zurich-lloyd-s-syndicate-1.csv`,
    );
  });

  it("names the filter in the header row and includes the comparison", () => {
    const pair = [options[0], options[1]];
    const lines = miReportCsv(report(pair)).split("\r\n");
    expect(lines[0]).toBe(`Complaints MI,${FROM} to ${TODAY},"Insurers: ${pair.join(", ")}"`);
    expect(lines[1]).toBe("Measure,Category,Value");
    expect(lines).toContain(`Insurers,,"${pair.join(", ")}"`);
    expect(lines.some((l) => l.startsWith(`Insurer comparison: received,${options[0]},`))).toBe(true);
    expect(miReportCsv(report()).split("\r\n")[0]).toBe(`Complaints MI,${FROM} to ${TODAY},Insurers: All insurers`);
    expect(insurerFilterLabel([])).toBe("All insurers");
  });
});
