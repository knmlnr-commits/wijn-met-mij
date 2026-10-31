import { describe, expect, it } from "vitest";
import { STATUSES } from "@/lib/domain/complaint";
import { addDays, buildTimeline, isAfter, type Rag } from "@/lib/rules";
import { EW_2026_DATES, SEEDED_INSURERS } from "@/lib/rules/test-fixtures";
import { DEMO_COUNT, generateDemoComplaints } from "@/scripts/lib/demo-data";

function rags(today: string): Rag[] {
  return generateDemoComplaints(today).map(({ insurer, row }) =>
    buildTimeline({
      receivedDate: row.received_date,
      profile: SEEDED_INSURERS[insurer],
      lifecycle: {
        acknowledgedDate: row.acknowledged_date,
        holdingResponseDate: row.holding_response_date,
        finalResponseDate: row.final_response_date,
        resolutionPath: row.resolution_path,
      },
      today,
      holidays: EW_2026_DATES,
    }).rag,
  );
}

describe("synthetic demo complaints", () => {
  const today = "2026-10-30";
  const demo = generateDemoComplaints(today);

  it("creates 25 complaints covering every status", () => {
    expect(DEMO_COUNT).toBe(25);
    expect(new Set(demo.map((d) => d.row.status))).toEqual(new Set(STATUSES));
  });

  it("covers every RAG state on every day of 2026, bank holidays included", () => {
    const expected = rags(today);
    for (let i = 0; i < 365; i++) {
      const day = addDays("2026-01-01", i);
      const result = rags(day);
      expect(new Set(result), day).toEqual(new Set(["red", "amber", "green"]));
      expect(result, day).toEqual(expected);
    }
  });

  it("never dates anything in the future or before receipt", () => {
    for (const { row, events } of demo) {
      const dates = [
        row.acknowledged_date, row.holding_response_date, row.final_response_date, row.fos_referred_date,
        row.lloyds_referred_date, row.fos_closed_date, row.lloyds_closed_date, row.closed_date,
        ...events.map((e) => e.occurred_on),
      ].filter((d): d is string => d !== null);
      for (const d of dates) {
        expect(isAfter(d, today)).toBe(false);
        expect(isAfter(row.received_date, d)).toBe(false);
      }
    }
  });

  it("keeps resolution data consistent with the workflow rules", () => {
    for (const { insurer, row, events } of demo) {
      if (row.final_response_date) expect(row.outcome).not.toBeNull();
      if (row.outcome && row.outcome !== "not_upheld") expect(row.upheld_against).not.toBeNull();
      if (row.compensation_amount) expect(row.compensation_paid_by).not.toBeNull();
      if (row.fos_referred_date || row.lloyds_referred_date) expect(row.final_response_date).not.toBeNull();
      if (row.lloyds_referred_date) expect(insurer).toBe("Lloyd's");
      expect(events[0].event_type).toBe("registered");
    }
  });

  it("uses only obviously synthetic personal data", () => {
    for (const { row } of demo) {
      expect(row.complainant_name).toMatch(/^Demo Complainant \d{2}$/);
      expect(row.complainant_email).toMatch(/@example\.test$/);
    }
  });
});
