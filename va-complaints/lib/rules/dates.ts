/**
 * Calendar date helpers. Business dates are ISO `yyyy-mm-dd` strings throughout the engine;
 * all arithmetic runs in UTC so the server time zone can never shift a date.
 */
export type IsoDate = string;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;

export function isIsoDate(value: string): boolean {
  const m = ISO_DATE.exec(value);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return toIsoDate(d) === value;
}

export function assertIsoDate(value: string, field: string): IsoDate {
  if (!isIsoDate(value)) throw new RangeError(`${field} must be a valid date in yyyy-mm-dd format`);
  return value;
}

function toUtc(date: IsoDate): Date {
  const m = ISO_DATE.exec(date);
  if (!m) throw new RangeError("Invalid date; expected yyyy-mm-dd");
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

function toIsoDate(d: Date): IsoDate {
  return d.toISOString().slice(0, 10);
}

/** Days since the Unix epoch; used for differences and ordering. */
export function dayNumber(date: IsoDate): number {
  return Math.round(toUtc(date).getTime() / MS_PER_DAY);
}

export function addDays(date: IsoDate, days: number): IsoDate {
  return toIsoDate(new Date(toUtc(date).getTime() + days * MS_PER_DAY));
}

/**
 * Adds whole years. A 29 February start rolls forward to 1 March in a non leap year, so a
 * retention period is never shortened by a day.
 */
export function addYears(date: IsoDate, years: number): IsoDate {
  const d = toUtc(date);
  d.setUTCFullYear(d.getUTCFullYear() + years);
  return toIsoDate(d);
}

export function daysBetween(from: IsoDate, to: IsoDate): number {
  return dayNumber(to) - dayNumber(from);
}

/** 0 = Sunday ... 6 = Saturday. */
export function weekday(date: IsoDate): number {
  return toUtc(date).getUTCDay();
}

export function isAfter(a: IsoDate, b: IsoDate): boolean {
  return dayNumber(a) > dayNumber(b);
}

export function isOnOrBefore(a: IsoDate, b: IsoDate): boolean {
  return dayNumber(a) <= dayNumber(b);
}

/** Display format for the UI and letters: dd-mm-yyyy. */
export function formatDisplayDate(date: IsoDate): string {
  const [y, m, d] = date.split("-");
  return `${d}-${m}-${y}`;
}

/** Today's date in UTC as an ISO date. */
export function todayUtc(now: Date = new Date()): IsoDate {
  return toIsoDate(now);
}
