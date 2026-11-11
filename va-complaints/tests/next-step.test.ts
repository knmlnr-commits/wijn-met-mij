import { describe, expect, it } from "vitest";
import { nextStep } from "@/lib/complaints/next-step";
import { buildView } from "@/lib/complaints/view";
import { CONTEXT, complaintRow, demoViews } from "./fixtures";

const step = (today: string, overrides = {}) => {
  const v = buildView(complaintRow(overrides), CONTEXT, today);
  return nextStep(v.complaint, v.timeline);
};

describe("next step", () => {
  it("a new complaint: acknowledge, with the summary route as an option", () => {
    const s = step("2026-10-01");
    expect(s).toMatchObject({ tone: "soon", action: "acknowledge", title: "Send the acknowledgement by 02-10-2026" });
    expect(s.detail).toContain("summary resolution is possible until 06-10-2026");
  });

  it("an overdue acknowledgement is urgent", () => {
    expect(step("2026-10-05")).toMatchObject({ tone: "urgent", action: "acknowledge", title: "Send the acknowledgement now" });
  });

  it("acknowledged and on track: investigate, with the deadline", () => {
    expect(step("2026-10-12", { acknowledged_date: "2026-10-02", status: "investigating" })).toMatchObject({
      tone: "normal",
      title: "Investigate; final response due 26-11-2026 (45 days left)",
    });
  });

  it("week 4 without a holding response: send one", () => {
    expect(step("2026-10-30", { acknowledged_date: "2026-10-02" })).toMatchObject({ tone: "soon", action: "holding" });
  });

  it("inside the amber window: send the final response", () => {
    expect(step("2026-11-20", { acknowledged_date: "2026-10-02", holding_response_date: "2026-10-29" })).toMatchObject({
      tone: "soon",
      action: "final",
      title: "Send the final response by 26-11-2026 (6 days left)",
    });
  });

  it("past the deadline is urgent and mentions the FOS rights", () => {
    const s = step("2026-11-28", { acknowledged_date: "2026-10-02" });
    expect(s).toMatchObject({ tone: "urgent", action: "final", title: "Send the final response; the deadline passed 2 days ago" });
    expect(s.detail).toContain("FOS referral rights");
  });

  it("after resolution: close, pay compensation, or await the referral outcome", () => {
    const resolved = { acknowledged_date: "2026-10-02", final_response_date: "2026-10-20", resolution_path: "final_response" as const };
    expect(step("2026-10-25", { ...resolved, status: "resolved" })).toMatchObject({ action: "close", title: "Close the complaint" });
    expect(step("2026-10-25", { ...resolved, status: "compensation_outstanding" })).toMatchObject({ action: "compensation", tone: "soon" });
    expect(step("2026-10-25", { ...resolved, status: "referred_to_fos", fos_referred_date: "2026-10-22" })).toMatchObject({ action: "fosOutcome" });
    expect(step("2026-10-25", { ...resolved, status: "closed", closed_date: "2026-10-24" })).toMatchObject({ tone: "done", action: null });
  });

  it("gives every demo complaint a step whose action exists", () => {
    for (const v of demoViews("2026-10-30")) {
      const s = nextStep(v.complaint, v.timeline);
      expect(s.title.length).toBeGreaterThan(3);
      if (v.timeline.acknowledgementOverdue || v.timeline.finalResponseOverdue) expect(s.tone).toBe("urgent");
    }
  });
});
