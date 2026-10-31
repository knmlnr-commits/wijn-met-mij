import { describe, expect, it } from "vitest";
import { availableActions, type PolicyInput } from "@/lib/complaints/policy";
import { buildView, filterViews, kpis, sortByRisk } from "@/lib/complaints/view";
import { formatDate, formatDateTime, formatGBP } from "@/lib/format";
import { buildMiReport, csvCell, miReportCsv, ucrDueDate } from "@/lib/reports/mi";
import { EW_2026_DATES } from "@/lib/rules/test-fixtures";
import { CONTEXT, complaintRow, demoViews } from "./fixtures";

const TODAY = "2026-10-30";

function policy(overrides: Partial<PolicyInput["complaint"]> = {}, extra: Partial<PolicyInput> = {}) {
  const input: PolicyInput = {
    complaint: {
      status: "new",
      acknowledged_date: null,
      final_response_date: null,
      resolution_path: null,
      lloyds_referred_date: null,
      fos_referred_date: null,
      closed_date: null,
      is_deleted: false,
      ...overrides,
    },
    timeline: { summaryEligible: true, summaryDeadline: "2026-10-06" },
    insurerIsLloyds: false,
    role: "handler",
    ...extra,
  };
  return Object.fromEntries(availableActions(input).map((a) => [a.key, a]));
}

describe("action policy", () => {
  it("a new complaint can be acknowledged, summary resolved or answered, but not referred or closed", () => {
    const a = policy();
    expect(a.acknowledge.enabled && a.summary.enabled && a.final.enabled && a.holding.enabled).toBe(true);
    expect(a.referFos.reason).toBe("Send the final response first.");
    expect(a.close.reason).toBe("Send a final response or record a summary resolution first.");
    expect(a.delete.reason).toBe("Only a Manager can delete a complaint.");
  });

  it("explains when the summary route has closed", () => {
    const a = policy({}, { timeline: { summaryEligible: false, summaryDeadline: "2026-10-06" } });
    expect(a.summary.enabled).toBe(false);
    expect(a.summary.reason).toBe("The summary route closed on 06-10-2026; send a final response instead.");
  });

  it("after a final response: referral and compensation open, response actions closed", () => {
    const a = policy({ final_response_date: "2026-10-20", resolution_path: "final_response", status: "resolved" });
    expect(a.referFos.enabled && a.compensation.enabled && a.close.enabled).toBe(true);
    expect(a.final.reason).toBe("The complaint is already resolved.");
    expect(a.referLloyds.reason).toBe("Only complaints for a Lloyd's insurer go to Lloyd's.");
  });

  it("Lloyd's referral for a Lloyd's insurer, and the outcome once referred", () => {
    const a = policy(
      { final_response_date: "2026-10-20", resolution_path: "final_response", lloyds_referred_date: "2026-10-25" },
      { insurerIsLloyds: true },
    );
    expect(a.referLloyds.reason).toBe("Referred to Lloyd's on 25-10-2026.");
    expect(a.lloydsOutcome.enabled).toBe(true);
    expect(a.fosOutcome.reason).toBe("Refer the complaint to the FOS first.");
  });

  it("compliance sees every action disabled as read only", () => {
    const a = policy({}, { role: "compliance" });
    expect(Object.values(a).every((x) => !x.enabled && x.reason === "Compliance has read only access.")).toBe(true);
  });

  it("a manager can delete; nothing is possible on a deleted complaint", () => {
    expect(policy({}, { role: "manager" }).delete.enabled).toBe(true);
    expect(Object.values(policy({ is_deleted: true }, { role: "manager" })).every((x) => !x.enabled)).toBe(true);
  });

  it("a closed complaint can still be referred after its final response", () => {
    const a = policy({ status: "closed", closed_date: "2026-10-22", final_response_date: "2026-10-20", resolution_path: "final_response" });
    expect(a.referFos.enabled).toBe(true);
    expect(a.status.reason).toBe("The complaint is closed.");
    expect(a.close.reason).toBe("Closed on 22-10-2026.");
  });
});

describe("dashboard", () => {
  const views = demoViews(TODAY);

  it("sorts most at risk first", () => {
    const sorted = sortByRisk(views).map((v) => v.timeline.rag);
    const firstAmber = sorted.indexOf("amber");
    const firstGreen = sorted.indexOf("green");
    expect(sorted.slice(0, firstAmber).every((r) => r === "red")).toBe(true);
    expect(sorted.slice(firstAmber, firstGreen).every((r) => r === "amber")).toBe(true);
    expect(sorted.slice(firstGreen).every((r) => r === "green")).toBe(true);
  });

  it("filters by RAG, insurer, handler, status, vulnerability and search", () => {
    expect(filterViews(views, { rag: "red" }).length).toBe(4);
    expect(filterViews(views, { insurerId: "ins-Aviva" }).every((v) => v.insurerName === "Aviva")).toBe(true);
    expect(filterViews(views, { handlerId: "p-manager" }).length).toBe(3);
    expect(filterViews(views, { status: "closed" }).length).toBe(3);
    expect(filterViews(views, { vulnerable: true }).length).toBe(0);
    expect(filterViews(views, { search: "c-000007" }).map((v) => v.complaint.reference)).toEqual(["C-000007"]);
    expect(filterViews(views, { search: "DEMO-CLM-12" }).length).toBe(1);
  });

  it("computes the KPI tiles", () => {
    const k = kpis(views);
    expect(k.open + k.resolvedOrClosed).toBe(25);
    expect(k.breaching).toBe(4);
    expect(k.dueWithin7Days).toBeGreaterThanOrEqual(1);
    // Upheld or partially upheld: 3 of the 9 final responses.
    expect(k.upheldRate).toBe(33.3);
  });
});

describe("DISP 1.10 MI", () => {
  const views = demoViews(TODAY);
  const labels = { product: new Map(), nature: new Map(), rootCause: new Map(), firmShortName: "Van Ameyde" };

  it("counts complaints received in the range, judging timeliness per insurer profile", () => {
    const r = buildMiReport(views, "2025-01-01", TODAY, labels);
    expect(r.received).toBe(25);
    expect(r.finalResponses).toBe(9);
    // One final response was sent after its deadline (demo complaint 16).
    expect(r.finalResponsesInTime).toBe(8);
    expect(r.percentInTime).toBe(88.9);
    expect(r.summaryResolutions).toBe(2);
    expect(r.totalCompensation).toBe(445.5);
    expect(r.byInsurer.reduce((s, b) => s + b.count, 0)).toBe(25);
    expect(r.byUpheldAgainst.map((b) => b.label).sort()).toEqual(["Insurer", "Van Ameyde"]);
  });

  it("limits to the received date range", () => {
    const r = buildMiReport(views, "2026-10-01", TODAY, labels);
    expect(r.received).toBe(views.filter((v) => v.complaint.received_date >= "2026-10-01").length);
  });

  it("exports CSV that neutralises spreadsheet formulas", () => {
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell('Claim, "quantum"')).toBe('"Claim, ""quantum"""');
    const csv = miReportCsv(buildMiReport(views, "2025-01-01", TODAY, labels));
    expect(csv.split("\r\n")[0]).toBe("Measure,Category,Value");
    expect(csv).toContain("Complaints received,,25");
  });

  it("dates the PS25/19 return 30 business days after the period end", () => {
    expect(ucrDueDate("2026-09-30", EW_2026_DATES)).toBe("2026-11-11");
  });
});

describe("formatting", () => {
  it("shows dates as dd-mm-yyyy, times in UK time and amounts in GBP", () => {
    expect(formatDate("2026-06-01")).toBe("01-06-2026");
    expect(formatDate(null)).toBe("Not set");
    expect(formatDateTime("2026-06-01T12:30:00Z")).toBe("01-06-2026 13:30");
    expect(formatDateTime("2026-12-01T12:30:00Z")).toBe("01-12-2026 12:30");
    expect(formatGBP(120.5)).toBe("£120.50");
    expect(formatGBP(1234)).toBe("£1,234.00");
  });

  it("a view resolves the insurer and handler names", () => {
    const v = buildView(complaintRow(), CONTEXT, TODAY);
    expect(v.insurerName).toBe("Zurich");
    expect(v.handlerName).toBe("Demo Handler");
  });
});
