import type { ComplaintRow } from "@/lib/db/types";
import { formatDate } from "@/lib/format";
import type { Timeline } from "@/lib/rules";
import type { ActionKey } from "./policy";

/**
 * The one thing to do next on a complaint, in plain words. Drives the dashboard's "Next step"
 * column and the banner on the complaint page, so a handler never has to work it out.
 */
export type StepTone = "urgent" | "soon" | "normal" | "done";

export interface NextStep {
  tone: StepTone;
  title: string;
  detail: string | null;
  /** The action to open on the complaint page, if any. */
  action: ActionKey | null;
}

type StepComplaint = Pick<
  ComplaintRow,
  | "status"
  | "resolution_path"
  | "is_deleted"
  | "fos_referred_date"
  | "fos_decision"
  | "lloyds_referred_date"
  | "lloyds_outcome"
  | "holding_response_date"
>;

const days = (n: number) => `${n} ${n === 1 ? "day" : "days"}`;

export function nextStep(c: StepComplaint, t: Timeline): NextStep {
  if (c.is_deleted) return { tone: "done", title: "Deleted", detail: "Kept until the retention period has passed.", action: null };
  if (c.status === "closed") return { tone: "done", title: "Closed", detail: "No action needed.", action: null };

  if (c.resolution_path !== null) {
    if (c.fos_referred_date && !c.fos_decision) {
      return { tone: "normal", title: "Record the FOS outcome when it arrives", detail: `Referred to the FOS on ${formatDate(c.fos_referred_date)}.`, action: "fosOutcome" };
    }
    if (c.lloyds_referred_date && !c.lloyds_outcome) {
      return { tone: "normal", title: "Record the Lloyd's outcome when it arrives", detail: `Referred to Lloyd's on ${formatDate(c.lloyds_referred_date)}.`, action: "lloydsOutcome" };
    }
    if (c.status === "actions_required_following_decision") {
      return { tone: "soon", title: "Complete the actions from the decision, then close", detail: null, action: "close" };
    }
    if (c.status === "compensation_outstanding") {
      return { tone: "soon", title: "Pay the compensation, then mark it paid", detail: null, action: "compensation" };
    }
    return {
      tone: "normal",
      title: "Close the complaint",
      detail: t.fosWindowEnd ? `The complainant can still refer it until ${formatDate(t.fosWindowEnd)}; record a referral if one arrives.` : null,
      action: "close",
    };
  }

  if (t.acknowledgementOverdue) {
    return { tone: "urgent", title: "Send the acknowledgement now", detail: `It was due on ${formatDate(t.acknowledgementDue)}.`, action: "acknowledge" };
  }
  if (t.finalResponseOverdue) {
    return {
      tone: "urgent",
      title: `Send the final response; the deadline passed ${days(-t.daysToDeadline)} ago`,
      detail: "If it cannot go today, send a holding response that explains the delay and gives the FOS referral rights.",
      action: "final",
    };
  }
  if (t.awaitingAcknowledgement) {
    return {
      tone: "soon",
      title: `Send the acknowledgement by ${formatDate(t.acknowledgementDue)}`,
      detail: t.summaryEligible ? `Or resolve it straight away: summary resolution is possible until ${formatDate(t.summaryDeadline)}.` : null,
      action: "acknowledge",
    };
  }
  if (t.rag === "amber") {
    return {
      tone: "soon",
      title: `Send the final response by ${formatDate(t.finalResponseDeadline)} (${days(t.daysToDeadline)} left)`,
      detail: t.interimHoldingDue ? "No holding response has been sent yet; consider sending one." : null,
      action: "final",
    };
  }
  if (t.interimHoldingDue) {
    return { tone: "soon", title: "Send a holding response (week 4 reached)", detail: `Final response due ${formatDate(t.finalResponseDeadline)}.`, action: "holding" };
  }
  return {
    tone: "normal",
    title: `Investigate; final response due ${formatDate(t.finalResponseDeadline)} (${days(t.daysToDeadline)} left)`,
    detail: t.summaryEligible ? `Summary resolution is possible until ${formatDate(t.summaryDeadline)}.` : null,
    action: "final",
  };
}
