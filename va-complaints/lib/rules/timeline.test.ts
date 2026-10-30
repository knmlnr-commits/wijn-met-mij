import { describe, expect, it } from "vitest";
import { FCA_DEFAULTS, resolveProfile, type SlaProfile } from "./constants";
import {
  buildTimeline,
  canHardDelete,
  fosWindowEndFor,
  isSummaryEligible,
  type LifecycleDates,
  ragStatus,
  retentionEnd,
  riskSortKey,
} from "./timeline";
import { EW_2026_DATES, SEEDED_INSURERS } from "./test-fixtures";

// Received Monday 1 June 2026. With the FCA defaults (acknowledgement 5 business days):
const RECEIVED = "2026-06-01";
const ACK_DUE = "2026-06-08"; // +5 business days
const SUMMARY_DEADLINE = "2026-06-04"; // +3 business days
const INTERIM = "2026-06-29"; // +28 calendar days
const FINAL_DEADLINE = "2026-07-27"; // +56 calendar days
const AMBER_START = "2026-07-13"; // deadline minus 14 days

const DEFAULT = resolveProfile();

function t(today: string, lifecycle: LifecycleDates = {}, profile: SlaProfile = DEFAULT, receivedDate = RECEIVED) {
  return buildTimeline({ receivedDate, profile, lifecycle, today, holidays: EW_2026_DATES });
}

const acked: LifecycleDates = { acknowledgedDate: "2026-06-02" };

describe("timeline dates (ported from build 38a7212)", () => {
  it("computes the key regulatory dates from receipt", () => {
    const r = t(RECEIVED);
    expect(r.acknowledgementDue).toBe(ACK_DUE);
    expect(r.summaryDeadline).toBe(SUMMARY_DEADLINE);
    expect(r.interimDate).toBe(INTERIM);
    expect(r.finalResponseDeadline).toBe(FINAL_DEADLINE);
    expect(r.amberWindowStart).toBe(AMBER_START);
    expect(r.retentionEnd).toBe("2029-06-01");
  });

  it("a new complaint inside the acknowledgement target is amber", () => {
    const r = t(RECEIVED);
    expect(r.rag).toBe("amber");
    expect(r.acknowledgementOverdue).toBe(false);
    expect(r.summaryEligible).toBe(true);
  });

  it("unacknowledged past target is red and flagged overdue", () => {
    const r = t("2026-06-09");
    expect(r.acknowledgementOverdue).toBe(true);
    expect(r.rag).toBe("red");
  });

  it("summary route is available through the third business day only", () => {
    expect(isSummaryEligible(t(SUMMARY_DEADLINE, acked))).toBe(true);
    expect(isSummaryEligible(t("2026-06-05", acked))).toBe(false);
  });

  it("a summary resolved complaint is green, even well past eight weeks", () => {
    const r = t("2026-08-26", { ...acked, resolutionPath: "summary_resolution" });
    expect(r.rag).toBe("green");
    expect(r.finalResponseOverdue).toBe(false);
  });

  it("a final response within the deadline is green and not late", () => {
    const r = t("2026-08-01", { ...acked, finalResponseDate: "2026-07-20", resolutionPath: "final_response" });
    expect(r.rag).toBe("green");
    expect(r.finalResponseLate).toBe(false);
  });

  it("a final response after the deadline is red and flagged late", () => {
    const r = t("2026-08-01", { ...acked, finalResponseDate: "2026-07-30", resolutionPath: "final_response" });
    expect(r.finalResponseLate).toBe(true);
    expect(r.rag).toBe("red");
  });

  it("eight weeks passed without a final response is red and overdue", () => {
    const r = t("2026-07-28", acked);
    expect(r.finalResponseOverdue).toBe(true);
    expect(r.rag).toBe("red");
  });

  it("within fourteen days of the deadline is amber", () => {
    expect(t("2026-07-17", acked).rag).toBe("amber");
  });

  it("acknowledged and well inside the clock is green", () => {
    expect(t("2026-06-10", acked).rag).toBe("green");
  });

  it("the interim holding point is a soft prompt, not a breach", () => {
    const r = t(INTERIM, acked);
    expect(r.interimHoldingDue).toBe(true);
    expect(r.rag).toBe("green");
  });

  it("the FOS referral window is 182 days after the final response", () => {
    const r = t("2026-08-01", { ...acked, finalResponseDate: "2026-07-20", resolutionPath: "final_response" });
    expect(r.fosWindowEnd).toBe("2027-01-18");
    expect(fosWindowEndFor("2026-07-20", DEFAULT)).toBe("2027-01-18");
  });

  it("there is no FOS window until a final response is sent", () => {
    expect(t("2026-06-10", acked).fosWindowEnd).toBeNull();
  });

  it("days to deadline counts down and goes negative", () => {
    expect(t(RECEIVED).daysToDeadline).toBe(56);
    expect(t("2026-07-28").daysToDeadline).toBe(-1);
  });

  it("retention is three years from receipt by default", () => {
    expect(retentionEnd(RECEIVED, DEFAULT)).toBe("2029-06-01");
    expect(canHardDelete(RECEIVED, DEFAULT, "2029-05-31")).toBe(false);
    expect(canHardDelete(RECEIVED, DEFAULT, "2029-06-01")).toBe(true);
  });

  it("retention is configurable per profile", () => {
    const six = resolveProfile({ retentionYears: 6 });
    expect(canHardDelete(RECEIVED, six, "2032-05-31")).toBe(false);
    expect(canHardDelete(RECEIVED, six, "2032-06-01")).toBe(true);
  });

  it("the acknowledgement target is configurable in business days", () => {
    expect(t(RECEIVED, {}, resolveProfile({ ackBusinessDays: 1 })).acknowledgementDue).toBe("2026-06-02");
  });

  it("the final response deadline is configurable per profile", () => {
    const strict = resolveProfile({ finalResponseDays: 28, amberWindowDays: 7 });
    expect(t(RECEIVED, acked, strict).finalResponseDeadline).toBe("2026-06-29");
    const overdue = t("2026-06-30", acked, strict);
    expect(overdue.finalResponseOverdue).toBe(true);
    expect(overdue.rag).toBe("red");
  });
});

describe("RAG, every branch", () => {
  it("red: acknowledgement overdue takes precedence over the amber window", () => {
    const r = t("2026-07-20");
    expect(r.acknowledgementOverdue).toBe(true);
    expect(ragStatus(r)).toBe("red");
  });

  it("red: a late final response stays red years later", () => {
    expect(t("2028-01-01", { ...acked, finalResponseDate: "2026-07-28", resolutionPath: "final_response" }).rag).toBe("red");
  });

  it("amber: awaiting acknowledgement up to and including the due date, red the day after", () => {
    expect(t(ACK_DUE).rag).toBe("amber");
    expect(t("2026-06-09").rag).toBe("red");
  });

  it("amber window starts on its first day and runs through the deadline day", () => {
    expect(t("2026-07-12", acked).rag).toBe("green");
    expect(t(AMBER_START, acked).rag).toBe("amber");
    expect(t(FINAL_DEADLINE, acked).rag).toBe("amber");
    expect(t(FINAL_DEADLINE, acked).finalResponseOverdue).toBe(false);
  });

  it("green: a final response on the deadline day is in time", () => {
    const r = t("2026-08-01", { ...acked, finalResponseDate: FINAL_DEADLINE, resolutionPath: "final_response" });
    expect(r.finalResponseLate).toBe(false);
    expect(r.rag).toBe("green");
  });

  it("green: a summary resolution without an acknowledgement does not breach", () => {
    const r = t("2026-06-20", { resolutionPath: "summary_resolution" });
    expect(r.awaitingAcknowledgement).toBe(false);
    expect(r.acknowledgementOverdue).toBe(false);
    expect(r.rag).toBe("green");
  });

  it("green: a final response sent before acknowledgement was due needs no acknowledgement", () => {
    const r = t("2026-06-20", { finalResponseDate: "2026-06-05", resolutionPath: "final_response" });
    expect(r.acknowledgementOverdue).toBe(false);
    expect(r.rag).toBe("green");
  });

  it("a late acknowledgement is recorded but is not a breach once sent", () => {
    const r = t("2026-06-12", { acknowledgedDate: "2026-06-10" });
    expect(r.acknowledgementLate).toBe(true);
    expect(r.rag).toBe("green");
  });
});

describe("soft flags", () => {
  it("the summary route expires after business day 3", () => {
    expect(t(SUMMARY_DEADLINE).summaryRouteExpired).toBe(false);
    expect(t("2026-06-05").summaryRouteExpired).toBe(true);
    expect(t("2026-06-05", { resolutionPath: "summary_resolution" }).summaryRouteExpired).toBe(false);
  });

  it("summary resolution is not available once a final response is sent", () => {
    expect(t("2026-06-02", { finalResponseDate: "2026-06-02", resolutionPath: "final_response" }).summaryEligible).toBe(false);
  });

  it("the interim prompt runs from week 4 to the deadline and clears with a holding response", () => {
    expect(t("2026-06-28", acked).interimHoldingDue).toBe(false);
    expect(t(FINAL_DEADLINE, acked).interimHoldingDue).toBe(true);
    expect(t("2026-07-28", acked).interimHoldingDue).toBe(false);
    expect(t(INTERIM, { ...acked, holdingResponseDate: INTERIM }).interimHoldingDue).toBe(false);
  });

  it("a holding response from the deadline day on must carry FOS rights", () => {
    expect(t("2026-07-26", acked).holdingRequiresFosRights).toBe(false);
    expect(t(FINAL_DEADLINE, acked).holdingRequiresFosRights).toBe(true);
    expect(t("2026-08-10", { ...acked, finalResponseDate: "2026-08-05" }).holdingRequiresFosRights).toBe(false);
  });
});

describe("bank holidays in the timeline", () => {
  it("pushes business-day milestones past Easter but not calendar-day milestones", () => {
    const withHolidays = buildTimeline({ receivedDate: "2026-04-01", profile: DEFAULT, today: "2026-04-01", holidays: EW_2026_DATES });
    expect(withHolidays.acknowledgementDue).toBe("2026-04-10");
    expect(withHolidays.summaryDeadline).toBe("2026-04-08");
    expect(withHolidays.finalResponseDeadline).toBe("2026-05-27");

    const without = buildTimeline({ receivedDate: "2026-04-01", profile: DEFAULT, today: "2026-04-01", holidays: [] });
    expect(without.acknowledgementDue).toBe("2026-04-08");
    expect(without.summaryDeadline).toBe("2026-04-06");
  });
});

describe("seeded insurer profiles", () => {
  it("Lloyd's: one business day acknowledgement, standard DISP clock", () => {
    const r = t(RECEIVED, {}, SEEDED_INSURERS["Lloyd's"]);
    expect(r.acknowledgementDue).toBe("2026-06-02");
    expect(r.summaryDeadline).toBe(SUMMARY_DEADLINE);
    expect(r.finalResponseDeadline).toBe(FINAL_DEADLINE);
    expect(t("2026-06-03", {}, SEEDED_INSURERS["Lloyd's"]).rag).toBe("red");
  });

  it("Lloyd's: summary deadline skips the summer bank holiday", () => {
    const r = t("2026-08-27", {}, SEEDED_INSURERS["Lloyd's"], "2026-08-27");
    expect(r.acknowledgementDue).toBe("2026-08-28");
    expect(r.summaryDeadline).toBe("2026-09-02");
  });

  it("Allianz: 40 day final response deadline moves the amber window", () => {
    const p = SEEDED_INSURERS.Allianz;
    expect(t(RECEIVED, acked, p).finalResponseDeadline).toBe("2026-07-11");
    expect(t("2026-06-26", acked, p).rag).toBe("green");
    expect(t("2026-06-27", acked, p).rag).toBe("amber");
    expect(t("2026-07-12", acked, p).rag).toBe("red");
  });

  it("AXA: two business day acknowledgement and six year retention", () => {
    const p = SEEDED_INSURERS.AXA;
    expect(t(RECEIVED, {}, p).acknowledgementDue).toBe("2026-06-03");
    expect(t(RECEIVED, {}, p).retentionEnd).toBe("2032-06-01");
    expect(canHardDelete(RECEIVED, p, "2029-06-01")).toBe(false);
  });

  it("Aviva: 28 day deadline coincides with the interim point", () => {
    const r = t("2026-06-29", acked, SEEDED_INSURERS.Aviva);
    expect(r.finalResponseDeadline).toBe("2026-06-29");
    expect(r.interimDate).toBe("2026-06-29");
    expect(r.interimHoldingDue).toBe(true);
    expect(r.holdingRequiresFosRights).toBe(true);
    expect(r.rag).toBe("amber");
    expect(t("2026-06-30", acked, SEEDED_INSURERS.Aviva).rag).toBe("red");
  });

  it("Zurich: standard clock with one business day acknowledgement", () => {
    const r = t(RECEIVED, {}, SEEDED_INSURERS.Zurich);
    expect(r.acknowledgementDue).toBe("2026-06-02");
    expect(r.finalResponseDeadline).toBe(FINAL_DEADLINE);
    expect(r.profile.amberWindowDays).toBe(FCA_DEFAULTS.amberWindowDays);
  });
});

describe("input validation and sorting", () => {
  it("rejects invalid dates", () => {
    expect(() => t("2026-02-30")).toThrow(RangeError);
    expect(() => t(RECEIVED, { acknowledgedDate: "01-06-2026" })).toThrow(RangeError);
  });

  it("sorts most at risk first: red, then amber, then green by nearest deadline", () => {
    const red = t("2026-06-09");
    const amberSoon = t("2026-07-20", acked);
    const greenLater = t("2026-06-10", acked);
    const resolved = t("2026-06-10", { resolutionPath: "summary_resolution" });
    const sorted = [resolved, greenLater, amberSoon, red].sort((a, b) => {
      const [ra, da] = riskSortKey(a);
      const [rb, db] = riskSortKey(b);
      return ra - rb || da - db;
    });
    expect(sorted).toEqual([red, amberSoon, greenLater, resolved]);
  });
});
