import { describe, expect, it } from "vitest";
import { BUILTIN_BANK_HOLIDAYS } from "@/lib/holidays/builtin";
import { parseGovUkBankHolidays } from "@/lib/holidays/govuk";
import { isIsoDate, weekday } from "@/lib/rules";
import { EW_2026_DATES } from "@/lib/rules/test-fixtures";

// Same shape as https://www.gov.uk/bank-holidays.json, trimmed to two events per division.
const FEED = {
  "england-and-wales": {
    division: "england-and-wales",
    events: [
      { title: "Good Friday", date: "2026-04-03", notes: "", bunting: false },
      { title: "Easter Monday", date: "2026-04-06", notes: "", bunting: true },
    ],
  },
  scotland: {
    division: "scotland",
    events: [{ title: "2nd January", date: "2026-01-02", notes: "", bunting: true }],
  },
};

describe("gov.uk bank holiday feed", () => {
  it("takes the England and Wales events only", () => {
    expect(parseGovUkBankHolidays(FEED)).toEqual([
      { date: "2026-04-03", name: "Good Friday", region: "england-and-wales" },
      { date: "2026-04-06", name: "Easter Monday", region: "england-and-wales" },
    ]);
  });

  it("rejects an unexpected shape", () => {
    expect(() => parseGovUkBankHolidays({})).toThrow(/england-and-wales/);
    expect(() => parseGovUkBankHolidays({ "england-and-wales": { events: [{ title: "X", date: "03-04-2026" }] } })).toThrow(/invalid event/);
  });
});

describe("built in bank holidays 2025 to 2027", () => {
  it("has eight valid weekday dates per year and matches the 2026 test fixture", () => {
    for (const year of ["2025", "2026", "2027"]) expect(BUILTIN_BANK_HOLIDAYS.filter((h) => h.date.startsWith(year))).toHaveLength(8);
    for (const h of BUILTIN_BANK_HOLIDAYS) {
      expect(isIsoDate(h.date)).toBe(true);
      expect([0, 6]).not.toContain(weekday(h.date));
    }
    expect(BUILTIN_BANK_HOLIDAYS.filter((h) => h.date.startsWith("2026")).map((h) => h.date)).toEqual(EW_2026_DATES);
  });

  it("has Good Friday and Easter Monday three days apart, on a Friday and a Monday", () => {
    for (const year of ["2025", "2026", "2027"]) {
      const good = BUILTIN_BANK_HOLIDAYS.find((h) => h.date.startsWith(year) && h.name === "Good Friday")!;
      const monday = BUILTIN_BANK_HOLIDAYS.find((h) => h.date.startsWith(year) && h.name === "Easter Monday")!;
      expect(weekday(good.date)).toBe(5);
      expect(weekday(monday.date)).toBe(1);
    }
  });
});
