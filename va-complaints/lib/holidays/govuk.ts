import { BANK_HOLIDAY_REGION, isIsoDate } from "@/lib/rules";

export const GOV_UK_BANK_HOLIDAYS_URL = "https://www.gov.uk/bank-holidays.json";

export interface BankHolidaySeed {
  date: string;
  name: string;
  region: string;
}

/** Parses the gov.uk feed and returns the England and Wales dates. Throws on an unexpected shape. */
export function parseGovUkBankHolidays(feed: unknown): BankHolidaySeed[] {
  const division = (feed as Record<string, { events?: unknown }> | null)?.[BANK_HOLIDAY_REGION];
  if (!division || !Array.isArray(division.events)) {
    throw new Error(`The bank holiday feed has no "${BANK_HOLIDAY_REGION}" events`);
  }
  return division.events.map((event: unknown) => {
    const e = event as { date?: unknown; title?: unknown };
    if (typeof e.date !== "string" || !isIsoDate(e.date) || typeof e.title !== "string") {
      throw new Error("The bank holiday feed contains an invalid event");
    }
    return { date: e.date, name: e.title, region: BANK_HOLIDAY_REGION };
  });
}
