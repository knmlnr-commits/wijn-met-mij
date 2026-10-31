import "server-only";
import type { ComplaintStatus } from "@/lib/domain/complaint";
import type { IsoDate } from "@/lib/rules";
import type { RegisterComplaintInput, UpdateDetailsInput } from "@/lib/validation/complaint";
import type { Db } from "./client";
import { check, DataError } from "./errors";
import type { ComplaintEventRow, ComplaintRow, NotificationRow } from "./types";

/**
 * Complaint repository. Reads go through RLS as the signed in user; every change is a call to
 * the matching workflow function, which writes the audit event in the same transaction.
 */

export interface ComplaintFilters {
  status?: ComplaintStatus;
  insurerId?: string;
  handlerId?: string;
  product?: string;
  vulnerable?: boolean;
  search?: string;
  includeDeleted?: boolean;
}

export async function listComplaints(db: Db, filters: ComplaintFilters = {}): Promise<ComplaintRow[]> {
  let query = db.from("complaints").select("*").order("received_date", { ascending: true });
  if (!filters.includeDeleted) query = query.eq("is_deleted", false);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.insurerId) query = query.eq("insurer_id", filters.insurerId);
  if (filters.handlerId) query = query.eq("handler_id", filters.handlerId);
  if (filters.product) query = query.eq("product", filters.product);
  if (filters.vulnerable !== undefined) query = query.eq("vulnerable_customer", filters.vulnerable);
  if (filters.search) {
    // Escape PostgREST filter syntax characters so the search term is always treated as text.
    const term = filters.search.replace(/[%,()*\\]/g, " ").trim();
    if (term) query = query.or(`reference.ilike.%${term}%,complainant_name.ilike.%${term}%,claim_reference.ilike.%${term}%`);
  }
  return check(await query) as ComplaintRow[];
}

export async function getComplaint(db: Db, id: string): Promise<ComplaintRow> {
  const row = check(await db.from("complaints").select("*").eq("id", id).maybeSingle()) as ComplaintRow | null;
  if (!row) throw new DataError("Complaint not found.", "not_found");
  return row;
}

export async function listEvents(db: Db, complaintId: string): Promise<ComplaintEventRow[]> {
  return check(
    await db.from("complaint_events").select("*").eq("complaint_id", complaintId).order("occurred_at", { ascending: true }),
  ) as ComplaintEventRow[];
}

export async function listNotifications(db: Db, complaintId: string): Promise<NotificationRow[]> {
  return check(
    await db.from("notifications").select("*").eq("complaint_id", complaintId).order("created_at", { ascending: true }),
  ) as NotificationRow[];
}

/** Soft deleted complaints, for the Manager's retention screen. */
export async function listDeletedComplaints(db: Db): Promise<ComplaintRow[]> {
  return check(await db.from("complaints").select("*").eq("is_deleted", true).order("received_date")) as ComplaintRow[];
}

// ---------------------------------------------------------------------------------------------
// Workflow calls
// ---------------------------------------------------------------------------------------------

async function rpc(db: Db, fn: string, args: Record<string, unknown>): Promise<unknown> {
  return check(await db.rpc(fn, args));
}

export async function registerComplaint(db: Db, input: RegisterComplaintInput): Promise<string> {
  return (await rpc(db, "register_complaint", { p: input })) as string;
}

export async function updateComplaintDetails(db: Db, id: string, changes: UpdateDetailsInput): Promise<void> {
  await rpc(db, "update_complaint_details", { p_id: id, p_changes: changes });
}

export async function setComplaintStatus(db: Db, id: string, status: ComplaintStatus): Promise<void> {
  await rpc(db, "set_complaint_status", { p_id: id, p_status: status });
}

export async function recordAcknowledgement(db: Db, id: string, date: IsoDate): Promise<void> {
  await rpc(db, "record_acknowledgement", { p_id: id, p_date: date });
}

export async function recordHoldingResponse(db: Db, id: string, date: IsoDate): Promise<void> {
  await rpc(db, "record_holding_response", { p_id: id, p_date: date });
}

export async function recordSummaryResolution(db: Db, id: string, findings: string | null): Promise<void> {
  await rpc(db, "record_summary_resolution", { p_id: id, p_findings: findings });
}

export interface FinalResponse {
  date: IsoDate;
  outcome: string;
  upheldAgainst: string | null;
  compensationAmount: number | null;
  compensationPaidBy: string | null;
  findings: string | null;
}

export async function recordFinalResponse(db: Db, id: string, r: FinalResponse): Promise<void> {
  await rpc(db, "record_final_response", {
    p_id: id,
    p_date: r.date,
    p_outcome: r.outcome,
    p_upheld_against: r.upheldAgainst,
    p_compensation_amount: r.compensationAmount,
    p_compensation_paid_by: r.compensationPaidBy,
    p_findings: r.findings,
  });
}

export async function referToLloyds(db: Db, id: string, date: IsoDate, reference: string | null): Promise<void> {
  await rpc(db, "refer_to_lloyds", { p_id: id, p_date: date, p_reference: reference });
}

export async function referToFos(db: Db, id: string, date: IsoDate, reference: string | null): Promise<void> {
  await rpc(db, "refer_to_fos", { p_id: id, p_date: date, p_reference: reference });
}

export interface EscalationOutcome {
  decision: string;
  ombudsmanDecision: string | null;
  closedDate: IsoDate | null;
  compensation: number | null;
  actionsRequired: boolean;
}

export async function recordLloydsOutcome(db: Db, id: string, o: EscalationOutcome): Promise<void> {
  await rpc(db, "record_lloyds_outcome", {
    p_id: id,
    p_outcome: o.decision,
    p_closed_date: o.closedDate,
    p_compensation: o.compensation,
    p_actions_required: o.actionsRequired,
  });
}

export async function recordFosOutcome(db: Db, id: string, o: EscalationOutcome): Promise<void> {
  await rpc(db, "record_fos_outcome", {
    p_id: id,
    p_fos_decision: o.decision,
    p_ombudsman_decision: o.ombudsmanDecision,
    p_closed_date: o.closedDate,
    p_compensation: o.compensation,
    p_actions_required: o.actionsRequired,
  });
}

export async function setCompensationStatus(
  db: Db,
  id: string,
  status: "compensation_outstanding" | "compensation_paid",
): Promise<void> {
  await rpc(db, "set_compensation_status", { p_id: id, p_status: status });
}

export async function closeComplaint(db: Db, id: string, date: IsoDate): Promise<void> {
  await rpc(db, "close_complaint", { p_id: id, p_date: date });
}

export async function softDeleteComplaint(db: Db, id: string, reason: string): Promise<void> {
  await rpc(db, "soft_delete_complaint", { p_id: id, p_reason: reason });
}

export async function hardDeleteComplaint(db: Db, id: string, reason: string): Promise<void> {
  await rpc(db, "hard_delete_complaint", { p_id: id, p_reason: reason });
}
