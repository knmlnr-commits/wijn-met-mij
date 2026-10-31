import { describe, expect, it } from "vitest";
import { addBusinessDays, createBusinessCalendar, holidayDates } from "./business-days";
import { EW_2026, EW_2026_DATES } from "./test-fixtures";

describe("business days, weekends only (ported from build 38a7212)", () => {
  const cal = createBusinessCalendar();

  it("adding zero returns the same date", () => {
    expect(cal.addBusinessDays("2026-06-22", 0)).toBe("2026-06-22");
  });

  it("one business day from Monday is Tuesday", () => {
    expect(cal.addBusinessDays("2026-06-22", 1)).toBe("2026-06-23");
  });

  it("skips the weekend", () => {
    expect(cal.addBusinessDays("2026-06-19", 1)).toBe("2026-06-22");
  });

  it("three business days from Thursday lands on Tuesday", () => {
    expect(cal.addBusinessDays("2026-06-18", 3)).toBe("2026-06-23");
  });

  it("Saturday and Sunday are not business days", () => {
    expect(cal.isBusinessDay("2026-06-20")).toBe(false);
    expect(cal.isBusinessDay("2026-06-21")).toBe(false);
    expect(cal.isBusinessDay("2026-06-22")).toBe(true);
  });

  it("skips a supplied holiday", () => {
    expect(addBusinessDays("2026-06-22", 1, ["2026-06-23"])).toBe("2026-06-24");
  });
});

describe("business days, England and Wales bank holidays", () => {
  const cal = createBusinessCalendar(EW_2026_DATES);

  it("skips Good Friday, the weekend and Easter Monday together", () => {
    expect(cal.addBusinessDays("2026-04-02", 1)).toBe("2026-04-07");
  });

  it("counts three business days across Easter", () => {
    expect(cal.addBusinessDays("2026-04-02", 3)).toBe("2026-04-09");
  });

  it("skips Christmas Day and the substitute Boxing Day", () => {
    expect(cal.addBusinessDays("2026-12-24", 1)).toBe("2026-12-29");
  });

  it("skips the summer bank holiday after a weekend", () => {
    expect(cal.addBusinessDays("2026-08-28", 1)).toBe("2026-09-01");
  });

  it("a weekend start counts from the next business day", () => {
    expect(cal.addBusinessDays("2026-06-20", 1)).toBe("2026-06-22");
  });

  it("supports negative counts", () => {
    expect(cal.addBusinessDays("2026-04-07", -1)).toBe("2026-04-02");
  });

  it("counts business days between two dates, excluding the start", () => {
    expect(cal.businessDaysBetween("2026-04-02", "2026-04-09")).toBe(3);
    expect(createBusinessCalendar().businessDaysBetween("2026-04-02", "2026-04-09")).toBe(5);
    expect(cal.businessDaysBetween("2026-04-09", "2026-04-02")).toBe(-3);
    expect(cal.businessDaysBetween("2026-04-09", "2026-04-09")).toBe(0);
  });

  it("bank holidays are not business days", () => {
    expect(cal.isBusinessDay("2026-12-28")).toBe(false);
  });
});

describe("holiday handling setting", () => {
  it("returns no holidays when the firm setting is off", () => {
    expect(holidayDates(EW_2026, false)).toEqual([]);
    expect(addBusinessDays("2026-04-02", 1, holidayDates(EW_2026, false))).toBe("2026-04-03");
  });

  it("uses only England and Wales dates when on", () => {
    const rows = [...EW_2026, { date: "2026-08-03", name: "Summer bank holiday", region: "scotland" }];
    expect(holidayDates(rows, true)).toEqual(EW_2026_DATES);
  });
});
