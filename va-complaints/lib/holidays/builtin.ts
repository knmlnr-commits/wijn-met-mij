import { BANK_HOLIDAY_REGION } from "@/lib/rules";
import type { BankHolidaySeed } from "./govuk";

/**
 * England and Wales bank holidays 2025 to 2027, so business days are right even before the
 * gov.uk feed has been loaded. TODO(CONFIRM): compiled by hand; "Load the latest dates from
 * gov.uk" in Settings replaces them with the official list (docs/OPEN_ITEMS.md).
 */
const DATES: [string, string][] = [
  ["2025-01-01", "New Year's Day"],
  ["2025-04-18", "Good Friday"],
  ["2025-04-21", "Easter Monday"],
  ["2025-05-05", "Early May bank holiday"],
  ["2025-05-26", "Spring bank holiday"],
  ["2025-08-25", "Summer bank holiday"],
  ["2025-12-25", "Christmas Day"],
  ["2025-12-26", "Boxing Day"],
  ["2026-01-01", "New Year's Day"],
  ["2026-04-03", "Good Friday"],
  ["2026-04-06", "Easter Monday"],
  ["2026-05-04", "Early May bank holiday"],
  ["2026-05-25", "Spring bank holiday"],
  ["2026-08-31", "Summer bank holiday"],
  ["2026-12-25", "Christmas Day"],
  ["2026-12-28", "Boxing Day"],
  ["2027-01-01", "New Year's Day"],
  ["2027-03-26", "Good Friday"],
  ["2027-03-29", "Easter Monday"],
  ["2027-05-03", "Early May bank holiday"],
  ["2027-05-31", "Spring bank holiday"],
  ["2027-08-30", "Summer bank holiday"],
  ["2027-12-27", "Christmas Day"],
  ["2027-12-28", "Boxing Day"],
];

export const BUILTIN_BANK_HOLIDAYS: BankHolidaySeed[] = DATES.map(([date, name]) => ({ date, name, region: BANK_HOLIDAY_REGION }));
