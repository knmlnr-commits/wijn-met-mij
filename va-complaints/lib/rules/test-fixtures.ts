/**
 * Test fixtures only. Not imported by application code.
 */
import { BANK_HOLIDAY_REGION, type BankHoliday } from "./business-days";
import { resolveProfile, type SlaProfile } from "./constants";

/**
 * England and Wales bank holidays for 2026, as test fixtures (the seed script loads the live
 * list from https://www.gov.uk/bank-holidays.json). Boxing Day falls on a Saturday, so the
 * substitute day is Monday 28 December.
 */
export const EW_2026: BankHoliday[] = [
  ["2026-01-01", "New Year's Day"],
  ["2026-04-03", "Good Friday"],
  ["2026-04-06", "Easter Monday"],
  ["2026-05-04", "Early May bank holiday"],
  ["2026-05-25", "Spring bank holiday"],
  ["2026-08-31", "Summer bank holiday"],
  ["2026-12-25", "Christmas Day"],
  ["2026-12-28", "Boxing Day"],
].map(([date, name]) => ({ date, name, region: BANK_HOLIDAY_REGION }));

export const EW_2026_DATES = EW_2026.map((h) => h.date);

/** Demo insurer profiles from spec section 5, as given in the build prompt. Amber window uses the default. */
export const SEEDED_INSURERS: Record<"Lloyd's" | "Allianz" | "AXA" | "Aviva" | "Zurich", SlaProfile> = {
  "Lloyd's": resolveProfile({ ackBusinessDays: 1, summaryBusinessDays: 3, interimDays: 28, finalResponseDays: 56, fosReferralDays: 182, retentionYears: 3 }),
  Allianz: resolveProfile({ ackBusinessDays: 1, summaryBusinessDays: 3, interimDays: 28, finalResponseDays: 40, fosReferralDays: 182, retentionYears: 3 }),
  AXA: resolveProfile({ ackBusinessDays: 2, summaryBusinessDays: 3, interimDays: 28, finalResponseDays: 56, fosReferralDays: 182, retentionYears: 6 }),
  Aviva: resolveProfile({ ackBusinessDays: 1, summaryBusinessDays: 3, interimDays: 28, finalResponseDays: 28, fosReferralDays: 182, retentionYears: 3 }),
  Zurich: resolveProfile({ ackBusinessDays: 1, summaryBusinessDays: 3, interimDays: 28, finalResponseDays: 56, fosReferralDays: 182, retentionYears: 3 }),
};
