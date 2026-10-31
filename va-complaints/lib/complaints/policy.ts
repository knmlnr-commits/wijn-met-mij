import type { ComplaintRow } from "@/lib/db/types";
import type { Role } from "@/lib/domain/complaint";
import { formatDate } from "@/lib/format";
import type { Timeline } from "@/lib/rules";

/**
 * Which workflow actions are available on a complaint, and why not when they are not.
 * The UI shows every action; disabled ones carry the reason. Server actions check the same
 * policy before calling the database, which enforces the state rules again.
 */

export const ACTION_KEYS = [
  "acknowledge",
  "status",
  "holding",
  "summary",
  "final",
  "referLloyds",
  "referFos",
  "lloydsOutcome",
  "fosOutcome",
  "compensation",
  "close",
  "edit",
  "delete",
] as const;
export type ActionKey = (typeof ACTION_KEYS)[number];

export const ACTION_LABELS: Record<ActionKey, string> = {
  acknowledge: "Send acknowledgement",
  status: "Change status",
  holding: "Send holding response",
  summary: "Summary resolution",
  final: "Send final response",
  referLloyds: "Refer to Lloyd's",
  referFos: "Refer to FOS",
  lloydsOutcome: "Record Lloyd's outcome",
  fosOutcome: "Record FOS outcome",
  compensation: "Compensation",
  close: "Close complaint",
  edit: "Edit details",
  delete: "Delete",
};

export interface ActionAvailability {
  key: ActionKey;
  label: string;
  enabled: boolean;
  reason: string | null;
}

export interface PolicyInput {
  complaint: Pick<
    ComplaintRow,
    | "status"
    | "acknowledged_date"
    | "final_response_date"
    | "resolution_path"
    | "lloyds_referred_date"
    | "fos_referred_date"
    | "closed_date"
    | "is_deleted"
  >;
  timeline: Pick<Timeline, "summaryEligible" | "summaryDeadline">;
  insurerIsLloyds: boolean;
  role: Role;
}

function decide(input: PolicyInput, key: ActionKey): string | null {
  const { complaint: c, timeline: t, insurerIsLloyds, role } = input;
  const resolved = c.resolution_path !== null;
  const closed = c.status === "closed";

  if (c.is_deleted) return "This complaint has been deleted.";
  if (role === "compliance") return "Compliance has read only access.";
  if (key === "delete") return role === "manager" ? null : "Only a Manager can delete a complaint.";
  if (key === "edit") return null;

  switch (key) {
    case "acknowledge":
      if (c.acknowledged_date) return `Already acknowledged on ${formatDate(c.acknowledged_date)}.`;
      if (closed) return "The complaint is closed.";
      return null;
    case "status":
      return closed ? "The complaint is closed." : null;
    case "holding":
      if (resolved) return "The complaint is resolved; a holding response is no longer needed.";
      return closed ? "The complaint is closed." : null;
    case "summary":
      if (resolved) return "The complaint is already resolved.";
      if (closed) return "The complaint is closed.";
      if (!t.summaryEligible) {
        return `The summary route closed on ${formatDate(t.summaryDeadline)}; send a final response instead.`;
      }
      return null;
    case "final":
      if (resolved) return "The complaint is already resolved.";
      return closed ? "The complaint is closed." : null;
    case "referLloyds":
      if (!insurerIsLloyds) return "Only complaints for a Lloyd's insurer go to Lloyd's.";
      if (!c.final_response_date) return "Send the final response first.";
      if (c.lloyds_referred_date) return `Referred to Lloyd's on ${formatDate(c.lloyds_referred_date)}.`;
      return null;
    case "referFos":
      if (!c.final_response_date) return "Send the final response first.";
      if (c.fos_referred_date) return `Referred to the FOS on ${formatDate(c.fos_referred_date)}.`;
      return null;
    case "lloydsOutcome":
      return c.lloyds_referred_date ? null : "Refer the complaint to Lloyd's first.";
    case "fosOutcome":
      return c.fos_referred_date ? null : "Refer the complaint to the FOS first.";
    case "compensation":
      return resolved ? null : "Resolve the complaint first.";
    case "close":
      if (closed) return `Closed on ${formatDate(c.closed_date)}.`;
      // Open item 18: closing without a resolution (for example withdrawn) awaits W&C.
      return resolved ? null : "Send a final response or record a summary resolution first.";
  }
}

export function availableActions(input: PolicyInput): ActionAvailability[] {
  return ACTION_KEYS.map((key) => {
    const reason = decide(input, key);
    return { key, label: ACTION_LABELS[key], enabled: reason === null, reason };
  });
}

/** Throws when an action is not available; used by the server actions before any write. */
export function assertActionAllowed(input: PolicyInput, key: ActionKey): void {
  const reason = decide(input, key);
  if (reason) throw new PolicyError(reason);
}

export class PolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PolicyError";
  }
}
