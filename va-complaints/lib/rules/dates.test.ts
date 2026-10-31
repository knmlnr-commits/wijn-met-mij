import { describe, expect, it } from "vitest";
import { addDays, addYears, daysBetween, formatDisplayDate, isIsoDate, todayUtc } from "./dates";

describe("dates", () => {
  it("validates ISO dates strictly", () => {
    expect(isIsoDate("2026-06-01")).toBe(true);
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("01-06-2026")).toBe(false);
    expect(isIsoDate("2026-6-1")).toBe(false);
  });

  it("adds days across month and year ends", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("is not affected by the clock change at the end of March", () => {
    expect(addDays("2026-03-28", 2)).toBe("2026-03-30");
    expect(daysBetween("2026-03-28", "2026-03-30")).toBe(2);
  });

  it("rolls 29 February forward so retention is never shortened", () => {
    expect(addYears("2024-02-29", 3)).toBe("2027-03-01");
    expect(addYears("2024-02-29", 4)).toBe("2028-02-29");
  });

  it("formats dates as dd-mm-yyyy for display", () => {
    expect(formatDisplayDate("2026-06-01")).toBe("01-06-2026");
  });

  it("takes today in UTC", () => {
    expect(todayUtc(new Date("2026-10-30T23:30:00Z"))).toBe("2026-10-30");
  });
});
