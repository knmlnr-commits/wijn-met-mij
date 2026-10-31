import {
  type BankHoliday,
  buildTimeline,
  holidayDates,
  type IsoDate,
  resolveProfile,
  type SlaKey,
  type SlaProfile,
  type Timeline,
} from "@/lib/rules";
import type { ComplaintRow, FirmSettingsRow, InsurerRow, SlaColumns } from "./types";

const COLUMN_FOR: Record<SlaKey, keyof SlaColumns> = {
  ackBusinessDays: "ack_business_days",
  summaryBusinessDays: "summary_business_days",
  interimDays: "interim_days",
  finalResponseDays: "final_response_days",
  fosReferralDays: "fos_referral_days",
  amberWindowDays: "amber_window_days",
  retentionYears: "retention_years",
};

/** SLA profile for an insurer: insurer value, else firm setting, else rules engine default. */
export function slaProfileFor(insurer: SlaColumns | null, firm: SlaColumns | null): SlaProfile {
  const overrides: Partial<Record<SlaKey, number | null>> = {};
  for (const [key, column] of Object.entries(COLUMN_FOR) as [SlaKey, keyof SlaColumns][]) {
    overrides[key] = insurer?.[column] ?? firm?.[column] ?? null;
  }
  return resolveProfile(overrides);
}

/** Converts a profile back to database columns (for the settings forms). */
export function slaColumnsFrom(profile: Partial<Record<SlaKey, number | null>>): Partial<SlaColumns> {
  const columns: Partial<SlaColumns> = {};
  for (const [key, column] of Object.entries(COLUMN_FOR) as [SlaKey, keyof SlaColumns][]) {
    if (key in profile) columns[column] = profile[key] ?? null;
  }
  return columns;
}

/** The regulatory clock for a complaint, with its insurer profile and the firm's holiday setting. */
export function timelineForComplaint(
  complaint: Pick<
    ComplaintRow,
    "received_date" | "acknowledged_date" | "holding_response_date" | "final_response_date" | "resolution_path"
  >,
  insurer: InsurerRow | null,
  firm: FirmSettingsRow | null,
  holidays: readonly BankHoliday[],
  today: IsoDate,
): Timeline {
  return buildTimeline({
    receivedDate: complaint.received_date,
    profile: slaProfileFor(insurer, firm),
    lifecycle: {
      acknowledgedDate: complaint.acknowledged_date,
      holdingResponseDate: complaint.holding_response_date,
      finalResponseDate: complaint.final_response_date,
      resolutionPath: complaint.resolution_path,
    },
    today,
    holidays: holidayDates(holidays, firm?.bank_holidays_enabled ?? true),
  });
}
