import { addDays, dayNumber, type IsoDate, weekday } from "./dates";

/** The bank holiday region the business-day calendar uses (key in the gov.uk feed). */
export const BANK_HOLIDAY_REGION = "england-and-wales";

export interface BankHoliday {
  date: IsoDate;
  name: string;
  region: string;
}

/**
 * The holiday dates the engine should skip, given the firm setting. Holidays come from the
 * `bank_holidays` table and are passed in so the engine stays pure.
 */
export function holidayDates(holidays: readonly BankHoliday[], enabled: boolean): IsoDate[] {
  if (!enabled) return [];
  return holidays.filter((h) => h.region === BANK_HOLIDAY_REGION).map((h) => h.date);
}

export interface BusinessCalendar {
  isBusinessDay(date: IsoDate): boolean;
  /**
   * The date `count` business days after `start`. The start date itself is not counted;
   * counting begins the next day. A count of 0 returns the start date unchanged.
   */
  addBusinessDays(start: IsoDate, count: number): IsoDate;
  /** Business days between two dates, excluding `from`; negative when `to` is earlier. */
  businessDaysBetween(from: IsoDate, to: IsoDate): number;
}

/** Skips Saturdays, Sundays and every holiday supplied. */
export function createBusinessCalendar(holidays: readonly IsoDate[] = []): BusinessCalendar {
  const holidaySet = new Set(holidays);

  const isBusinessDay = (date: IsoDate): boolean => {
    const day = weekday(date);
    return day !== 0 && day !== 6 && !holidaySet.has(date);
  };

  const addBusinessDays = (start: IsoDate, count: number): IsoDate => {
    const step = count >= 0 ? 1 : -1;
    let remaining = Math.abs(Math.trunc(count));
    let date = start;
    while (remaining > 0) {
      date = addDays(date, step);
      if (isBusinessDay(date)) remaining--;
    }
    return date;
  };

  const businessDaysBetween = (from: IsoDate, to: IsoDate): number => {
    const step = dayNumber(to) >= dayNumber(from) ? 1 : -1;
    let count = 0;
    let date = from;
    while (date !== to) {
      date = addDays(date, step);
      if (isBusinessDay(date)) count += step;
    }
    return count;
  };

  return { isBusinessDay, addBusinessDays, businessDaysBetween };
}

/** Convenience wrapper for one-off calculations. */
export function addBusinessDays(start: IsoDate, count: number, holidays: readonly IsoDate[] = []): IsoDate {
  return createBusinessCalendar(holidays).addBusinessDays(start, count);
}
