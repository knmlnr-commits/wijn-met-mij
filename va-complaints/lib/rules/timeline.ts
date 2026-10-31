import { createBusinessCalendar } from "./business-days";
import type { SlaProfile } from "./constants";
import { addDays, addYears, assertIsoDate, daysBetween, isAfter, type IsoDate, isOnOrBefore } from "./dates";

export type ResolutionPath = "summary_resolution" | "final_response";
export type Rag = "red" | "amber" | "green";

/** The lifecycle dates of a complaint that the clock depends on. */
export interface LifecycleDates {
  acknowledgedDate?: IsoDate | null;
  holdingResponseDate?: IsoDate | null;
  finalResponseDate?: IsoDate | null;
  resolutionPath?: ResolutionPath | null;
}

export interface TimelineInput {
  receivedDate: IsoDate;
  profile: SlaProfile;
  lifecycle?: LifecycleDates;
  today: IsoDate;
  /** Holiday dates to skip; pass `holidayDates(rows, firmSettings.bankHolidaysEnabled)`. */
  holidays?: readonly IsoDate[];
}

export interface Timeline {
  receivedDate: IsoDate;
  today: IsoDate;
  profile: SlaProfile;

  acknowledgementDue: IsoDate;
  summaryDeadline: IsoDate;
  interimDate: IsoDate;
  finalResponseDeadline: IsoDate;
  amberWindowStart: IsoDate;
  retentionEnd: IsoDate;
  /** Set once a final response has been sent. */
  fosWindowEnd: IsoDate | null;

  /** Awaiting acknowledgement: none sent and the complaint is not yet resolved. */
  awaitingAcknowledgement: boolean;
  acknowledgementOverdue: boolean;
  /** Acknowledgement was sent, but after the target. Recorded for MI; not a RAG breach. */
  acknowledgementLate: boolean;
  summaryResolved: boolean;
  summaryEligible: boolean;
  /** Business day 3 has passed without summary resolution; the complaint is now a formal complaint. */
  summaryRouteExpired: boolean;
  /** Week 4 reached without a holding response; soft prompt, not a breach. */
  interimHoldingDue: boolean;
  finalResponseSent: boolean;
  finalResponseOverdue: boolean;
  finalResponseLate: boolean;
  /** A holding response sent today must carry the FOS referral rights (deadline reached, no final response). */
  holdingRequiresFosRights: boolean;
  /** Calendar days to the final response deadline; negative once passed. */
  daysToDeadline: number;
  rag: Rag;
}

export function buildTimeline(input: TimelineInput): Timeline {
  const receivedDate = assertIsoDate(input.receivedDate, "receivedDate");
  const today = assertIsoDate(input.today, "today");
  const { profile } = input;
  const lc = input.lifecycle ?? {};
  for (const field of ["acknowledgedDate", "holdingResponseDate", "finalResponseDate"] as const) {
    const value = lc[field];
    if (value) assertIsoDate(value, field);
  }
  const calendar = createBusinessCalendar(input.holidays ?? []);

  const acknowledgementDue = calendar.addBusinessDays(receivedDate, profile.ackBusinessDays);
  const summaryDeadline = calendar.addBusinessDays(receivedDate, profile.summaryBusinessDays);
  const interimDate = addDays(receivedDate, profile.interimDays);
  const finalResponseDeadline = addDays(receivedDate, profile.finalResponseDays);
  const amberWindowStart = addDays(finalResponseDeadline, -profile.amberWindowDays);
  const retentionEnd = addYears(receivedDate, profile.retentionYears);

  const acknowledged = Boolean(lc.acknowledgedDate);
  const finalDate = lc.finalResponseDate ?? null;
  const finalResponseSent = finalDate !== null;
  const summaryResolved = lc.resolutionPath === "summary_resolution";
  const resolved = summaryResolved || finalResponseSent;
  const open = !resolved;

  const awaitingAcknowledgement = !acknowledged && open;
  const acknowledgementOverdue = awaitingAcknowledgement && isAfter(today, acknowledgementDue);
  const acknowledgementLate = acknowledged && isAfter(lc.acknowledgedDate as IsoDate, acknowledgementDue);

  const summaryEligible = open && isOnOrBefore(today, summaryDeadline);
  const summaryRouteExpired = open && isAfter(today, summaryDeadline);

  const interimHoldingDue =
    open && !lc.holdingResponseDate && !isAfter(interimDate, today) && isOnOrBefore(today, finalResponseDeadline);

  const finalResponseOverdue = open && isAfter(today, finalResponseDeadline);
  const finalResponseLate = finalResponseSent && isAfter(finalDate, finalResponseDeadline);
  const holdingRequiresFosRights = open && !isAfter(finalResponseDeadline, today);

  const fosWindowEnd = finalResponseSent ? fosWindowEndFor(finalDate, profile) : null;

  const rag = ragFor({
    acknowledgementOverdue,
    finalResponseOverdue,
    finalResponseLate,
    resolved,
    awaitingAcknowledgement,
    insideAmberWindow: open && !isAfter(amberWindowStart, today) && isOnOrBefore(today, finalResponseDeadline),
  });

  return {
    receivedDate,
    today,
    profile,
    acknowledgementDue,
    summaryDeadline,
    interimDate,
    finalResponseDeadline,
    amberWindowStart,
    retentionEnd,
    fosWindowEnd,
    awaitingAcknowledgement,
    acknowledgementOverdue,
    acknowledgementLate,
    summaryResolved,
    summaryEligible,
    summaryRouteExpired,
    interimHoldingDue,
    finalResponseSent,
    finalResponseOverdue,
    finalResponseLate,
    holdingRequiresFosRights,
    daysToDeadline: daysBetween(today, finalResponseDeadline),
    rag,
  };
}

interface RagFacts {
  acknowledgementOverdue: boolean;
  finalResponseOverdue: boolean;
  finalResponseLate: boolean;
  resolved: boolean;
  awaitingAcknowledgement: boolean;
  insideAmberWindow: boolean;
}

/**
 * Red: acknowledgement overdue; final response deadline passed without a final response; or
 * final response sent after the deadline (sticky).
 * Amber: inside the amber window of the final response deadline; or awaiting acknowledgement
 * but still inside target.
 * Green: on track, resolved within deadline, or summary resolved.
 */
function ragFor(f: RagFacts): Rag {
  if (f.finalResponseLate || f.acknowledgementOverdue || f.finalResponseOverdue) return "red";
  if (f.resolved) return "green";
  if (f.insideAmberWindow || f.awaitingAcknowledgement) return "amber";
  return "green";
}

/** Whether the summary resolution route is still open on `today`. */
export function isSummaryEligible(timeline: Timeline): boolean {
  return timeline.summaryEligible;
}

export function ragStatus(timeline: Timeline): Rag {
  return timeline.rag;
}

/** Last day the complainant can refer to the FOS, counted from the date the final response is sent. */
export function fosWindowEndFor(finalResponseDate: IsoDate, profile: SlaProfile): IsoDate {
  return addDays(assertIsoDate(finalResponseDate, "finalResponseDate"), profile.fosReferralDays);
}

/** Earliest date a record may be hard deleted (DISP 1.9 retention from receipt). */
export function retentionEnd(receivedDate: IsoDate, profile: SlaProfile): IsoDate {
  return addYears(assertIsoDate(receivedDate, "receivedDate"), profile.retentionYears);
}

/** Hard delete is blocked until the retention period has passed. Soft delete is always available to a Manager. */
export function canHardDelete(receivedDate: IsoDate, profile: SlaProfile, today: IsoDate): boolean {
  return !isAfter(retentionEnd(receivedDate, profile), assertIsoDate(today, "today"));
}

/** Sort key for the dashboard: most at risk first. Red before amber before green, then nearest deadline. */
export function riskSortKey(timeline: Timeline): [number, number] {
  const rank: Record<Rag, number> = { red: 0, amber: 1, green: 2 };
  return [rank[timeline.rag], timeline.finalResponseSent || timeline.summaryResolved ? Infinity : timeline.daysToDeadline];
}
