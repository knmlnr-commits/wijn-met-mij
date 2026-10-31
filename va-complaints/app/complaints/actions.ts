"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { type ActionResult, failure, formToObject, invalid } from "@/lib/actions/result";
import { requireRole } from "@/lib/auth/session";
import { type ActionKey, assertActionAllowed } from "@/lib/complaints/policy";
import { buildView } from "@/lib/complaints/view";
import { createUserClient, type Db } from "@/lib/db/client";
import * as repo from "@/lib/db/complaints";
import { getFirmSettings, listBankHolidays, listInsurers } from "@/lib/db/settings";
import type { Role } from "@/lib/domain/complaint";
import { todayUtc } from "@/lib/rules";
import {
  actionDateSchema,
  compensationStatusSchema,
  deletionSchema,
  escalationOutcomeSchema,
  finalResponseSchema,
  referralSchema,
  registerComplaintSchema,
  setStatusSchema,
  updateDetailsSchema,
} from "@/lib/validation/complaint";

/**
 * Server actions for the complaint workflow. Each one: checks the role (requireRole), validates
 * the input (zod), checks the action policy with the rules engine, then calls the matching
 * database function, which writes the audit event in the same transaction.
 */

const WRITERS: Role[] = ["handler", "manager"];

async function guarded(
  complaintId: string,
  key: ActionKey,
  roles: Role[],
  run: (db: Db) => Promise<void>,
  message: string,
): Promise<ActionResult> {
  try {
    const user = await requireRole(...roles);
    const db = await createUserClient();
    const [complaint, firm, insurers, holidays] = await Promise.all([
      repo.getComplaint(db, complaintId),
      getFirmSettings(db),
      listInsurers(db),
      listBankHolidays(db),
    ]);
    const view = buildView(complaint, { firm, insurers, holidays, profiles: [] }, todayUtc());
    assertActionAllowed(
      { complaint, timeline: view.timeline, insurerIsLloyds: view.insurer?.is_lloyds ?? false, role: user.role },
      key,
    );
    await run(db);
  } catch (error) {
    return failure(error);
  }
  revalidatePath(`/complaints/${complaintId}`);
  revalidatePath("/");
  return { ok: true, message };
}

const idOnly = z.object({ complaintId: z.uuid() });

/** Yes/no radio buttons; unanswered stays null. */
function claimRelated(form: FormData): boolean | null {
  const value = form.get("claim_related");
  return value === "yes" ? true : value === "no" ? false : null;
}

export async function registerComplaintAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const values = formToObject(form, { booleans: ["vulnerable_customer"], keepEmpty: ["complainant_name", "summary"] });
  values.claim_related = claimRelated(form);
  const parsed = registerComplaintSchema().safeParse(values);
  if (!parsed.success) return invalid(parsed.error);
  let id: string;
  try {
    await requireRole(...WRITERS);
    const db = await createUserClient();
    id = await repo.registerComplaint(db, parsed.data);
  } catch (error) {
    return failure(error);
  }
  revalidatePath("/");
  redirect(`/complaints/${id}`);
}

export async function updateDetailsAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const ids = idOnly.safeParse({ complaintId: form.get("complaintId") });
  if (!ids.success) return invalid(ids.error);
  form.delete("complaintId");
  const values = formToObject(form, { booleans: ["vulnerable_customer"], keepEmpty: ["complainant_name", "summary"] });
  values.claim_related = claimRelated(form);
  const parsed = updateDetailsSchema().safeParse(values);
  if (!parsed.success) return invalid(parsed.error);
  return guarded(ids.data.complaintId, "edit", WRITERS, (db) => repo.updateComplaintDetails(db, ids.data.complaintId, parsed.data), "Details saved.");
}

export async function acknowledgeAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const parsed = actionDateSchema().safeParse(formToObject(form));
  if (!parsed.success) return invalid(parsed.error);
  const { complaintId, date } = parsed.data;
  return guarded(complaintId, "acknowledge", WRITERS, (db) => repo.recordAcknowledgement(db, complaintId, date), "Acknowledgement recorded.");
}

export async function setStatusAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const parsed = setStatusSchema.safeParse(formToObject(form));
  if (!parsed.success) return invalid(parsed.error);
  const { complaintId, status } = parsed.data;
  return guarded(complaintId, "status", WRITERS, (db) => repo.setComplaintStatus(db, complaintId, status), "Status changed.");
}

export async function holdingAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const parsed = actionDateSchema().safeParse(formToObject(form));
  if (!parsed.success) return invalid(parsed.error);
  const { complaintId, date } = parsed.data;
  return guarded(complaintId, "holding", WRITERS, (db) => repo.recordHoldingResponse(db, complaintId, date), "Holding response recorded.");
}

export async function summaryAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const parsed = idOnly.extend({ findings: z.string().trim().max(20_000).nullable() }).safeParse(formToObject(form));
  if (!parsed.success) return invalid(parsed.error);
  const { complaintId, findings } = parsed.data;
  return guarded(
    complaintId,
    "summary",
    WRITERS,
    (db) => repo.recordSummaryResolution(db, complaintId, findings || null),
    "Summary resolution recorded.",
  );
}

export async function finalResponseAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const parsed = finalResponseSchema().safeParse(formToObject(form, { numbers: ["compensationAmount"] }));
  if (!parsed.success) return invalid(parsed.error);
  const { complaintId, ...response } = parsed.data;
  return guarded(complaintId, "final", WRITERS, (db) => repo.recordFinalResponse(db, complaintId, response), "Final response recorded.");
}

export async function referLloydsAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const parsed = referralSchema().safeParse(formToObject(form));
  if (!parsed.success) return invalid(parsed.error);
  const { complaintId, date, reference } = parsed.data;
  return guarded(complaintId, "referLloyds", WRITERS, (db) => repo.referToLloyds(db, complaintId, date, reference), "Referral to Lloyd's recorded.");
}

export async function referFosAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const parsed = referralSchema().safeParse(formToObject(form));
  if (!parsed.success) return invalid(parsed.error);
  const { complaintId, date, reference } = parsed.data;
  return guarded(complaintId, "referFos", WRITERS, (db) => repo.referToFos(db, complaintId, date, reference), "Referral to the FOS recorded.");
}

export async function lloydsOutcomeAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const parsed = escalationOutcomeSchema().safeParse(formToObject(form, { numbers: ["compensation"], booleans: ["actionsRequired"] }));
  if (!parsed.success) return invalid(parsed.error);
  const { complaintId, ...outcome } = parsed.data;
  return guarded(complaintId, "lloydsOutcome", WRITERS, (db) => repo.recordLloydsOutcome(db, complaintId, outcome), "Lloyd's outcome recorded.");
}

export async function fosOutcomeAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const parsed = escalationOutcomeSchema().safeParse(formToObject(form, { numbers: ["compensation"], booleans: ["actionsRequired"] }));
  if (!parsed.success) return invalid(parsed.error);
  const { complaintId, ...outcome } = parsed.data;
  return guarded(complaintId, "fosOutcome", WRITERS, (db) => repo.recordFosOutcome(db, complaintId, outcome), "FOS outcome recorded.");
}

export async function compensationAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const parsed = compensationStatusSchema.safeParse(formToObject(form));
  if (!parsed.success) return invalid(parsed.error);
  const { complaintId, status } = parsed.data;
  return guarded(complaintId, "compensation", WRITERS, (db) => repo.setCompensationStatus(db, complaintId, status), "Compensation status changed.");
}

export async function closeAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const parsed = actionDateSchema().safeParse(formToObject(form));
  if (!parsed.success) return invalid(parsed.error);
  const { complaintId, date } = parsed.data;
  return guarded(complaintId, "close", WRITERS, (db) => repo.closeComplaint(db, complaintId, date), "Complaint closed.");
}

export async function softDeleteAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const parsed = deletionSchema.safeParse(formToObject(form));
  if (!parsed.success) return invalid(parsed.error);
  const { complaintId, reason } = parsed.data;
  const result = await guarded(complaintId, "delete", ["manager"], (db) => repo.softDeleteComplaint(db, complaintId, reason), "Complaint deleted.");
  if (result.ok) redirect("/");
  return result;
}

/** Retention screen: permanent deletion after the retention period (checked again in the database). */
export async function hardDeleteAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const parsed = deletionSchema.safeParse(formToObject(form));
  if (!parsed.success) return invalid(parsed.error);
  try {
    await requireRole("manager");
    const db = await createUserClient();
    await repo.hardDeleteComplaint(db, parsed.data.complaintId, parsed.data.reason);
  } catch (error) {
    return failure(error);
  }
  revalidatePath("/settings/retention");
  return { ok: true, message: "Complaint permanently deleted." };
}
