import { describe, expect, it } from "vitest";
import { parseGovUkBankHolidays } from "@/scripts/lib/bank-holidays";

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
