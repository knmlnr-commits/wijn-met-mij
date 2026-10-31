import { formatDisplayDate, type IsoDate } from "@/lib/rules";

/** dd-mm-yyyy, or "Not set" when there is no date. */
export function formatDate(date: IsoDate | null | undefined): string {
  return date ? formatDisplayDate(date) : "Not set";
}

const DATE_TIME = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** A UTC timestamp shown in UK time as dd-mm-yyyy hh:mm. */
export function formatDateTime(timestamp: string): string {
  const parts = Object.fromEntries(DATE_TIME.formatToParts(new Date(timestamp)).map((p) => [p.type, p.value]));
  return `${parts.day}-${parts.month}-${parts.year} ${parts.hour}:${parts.minute}`;
}

const GBP = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function formatGBP(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined || amount === "") return "Not set";
  return GBP.format(Number(amount));
}

export function formatPercent(value: number | null): string {
  return value === null ? "Not applicable" : `${value.toFixed(1)}%`;
}
