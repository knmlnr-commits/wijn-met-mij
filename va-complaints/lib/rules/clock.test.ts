import { describe, expect, it } from "vitest";
import { clockModel } from "./clock";
import { resolveProfile } from "./constants";
import { buildTimeline } from "./timeline";
import { SEEDED_INSURERS } from "./test-fixtures";

const lloyds = (today: string) =>
  clockModel(buildTimeline({ receivedDate: "2026-06-01", profile: SEEDED_INSURERS["Lloyd's"], today }));

describe("regulatory clock model", () => {
  it("orders milestones by date", () => {
    expect(lloyds("2026-06-01").milestones.map((m) => m.key)).toEqual(["received", "acknowledgement", "summary", "interim", "final"]);
    // With the 5 business day default, acknowledgement falls after the day 3 summary deadline.
    const fca = clockModel(buildTimeline({ receivedDate: "2026-06-01", profile: resolveProfile(), today: "2026-06-01" }));
    expect(fca.milestones.map((m) => m.key)).toEqual(["received", "summary", "acknowledgement", "interim", "final"]);
  });

  it("labels milestones from the profile", () => {
    expect(lloyds("2026-06-01").milestones.map((m) => m.label)).toEqual([
      "Received",
      "Acknowledgement",
      "Day 3 summary",
      "Week 4 interim",
      "Final response deadline",
    ]);
  });

  it("places today at the start on the received date", () => {
    expect(lloyds("2026-06-01")).toMatchObject({ todayPosition: 0, todaySegment: 0 });
  });

  it("interpolates today inside its segment", () => {
    // Interim 29 June, final 27 July: 13 July is halfway through the last of four segments.
    const m = lloyds("2026-07-13");
    expect(m.todaySegment).toBe(3);
    expect(m.todayPosition).toBeCloseTo(0.875);
  });

  it("pins today to the end on and after the deadline", () => {
    expect(lloyds("2026-07-27")).toMatchObject({ todayPosition: 1, todaySegment: 4 });
    expect(lloyds("2026-09-01")).toMatchObject({ todayPosition: 1, todaySegment: 4 });
  });

  it("handles milestones that fall on the same day", () => {
    const m = clockModel(buildTimeline({ receivedDate: "2026-06-01", profile: SEEDED_INSURERS.Aviva, today: "2026-06-15" }));
    expect(m.milestones.at(-2)?.date).toBe(m.milestones.at(-1)?.date);
    expect(m.todayPosition).toBeGreaterThan(0.5);
    expect(m.todayPosition).toBeLessThan(0.75);
  });
});
