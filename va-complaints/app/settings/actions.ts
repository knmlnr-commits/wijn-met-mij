"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { type ActionResult, failure, formToObject, invalid } from "@/lib/actions/result";
import { originFrom } from "@/lib/auth/redirect";
import { requireRole } from "@/lib/auth/session";
import { createServiceClient, createUserClient } from "@/lib/db/client";
import { DataError } from "@/lib/db/errors";
import { slaProfileFor } from "@/lib/db/profile";
import * as settings from "@/lib/db/settings";
import { GOV_UK_BANK_HOLIDAYS_URL, parseGovUkBankHolidays } from "@/lib/holidays/govuk";
import { BANK_HOLIDAY_REGION, profileWarnings } from "@/lib/rules";
import {
  coverholderSchema,
  firmSettingsSchema,
  holidaySchema,
  insurerSchema,
  inviteSchema,
  profileUpdateSchema,
  referenceSchema,
  SLA_FIELDS,
} from "@/lib/validation/settings";

/** Manager only server actions. RLS limits the same writes to Managers in the database. */

function done(path: string, message: string): ActionResult {
  revalidatePath(path);
  revalidatePath("/framework");
  return { ok: true, message };
}

export async function saveFirmSettingsAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const parsed = firmSettingsSchema.safeParse(formToObject(form, { booleans: ["bank_holidays_enabled"], numbers: [...SLA_FIELDS] }));
  if (!parsed.success) return invalid(parsed.error);
  try {
    await requireRole("manager");
    await settings.updateFirmSettings(await createUserClient(), parsed.data);
  } catch (error) {
    return failure(error);
  }
  const warnings = profileWarnings(slaProfileFor(null, parsed.data));
  return done("/settings", warnings.length ? `Saved. Warning: ${warnings.map((w) => w.message).join(" ")}` : "Firm settings saved.");
}

export async function saveInsurerAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const parsed = insurerSchema.safeParse(formToObject(form, { booleans: ["is_active", "is_lloyds"], numbers: [...SLA_FIELDS] }));
  if (!parsed.success) return invalid(parsed.error);
  const { id, ...input } = parsed.data;
  let warnings: string[] = [];
  try {
    await requireRole("manager");
    const db = await createUserClient();
    await settings.saveInsurer(db, input, id ?? undefined);
    warnings = profileWarnings(slaProfileFor(input, await settings.getFirmSettings(db))).map((w) => w.message);
  } catch (error) {
    return failure(error);
  }
  // Warn, do not block: an insurer may contractually agree terms beyond the FCA limits.
  return done("/settings", warnings.length ? `Saved. Warning: ${warnings.join(" ")}` : `${input.name} saved.`);
}

export async function saveCoverholderAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const parsed = coverholderSchema.safeParse(formToObject(form, { booleans: ["is_active"] }));
  if (!parsed.success) return invalid(parsed.error);
  const { id, ...input } = parsed.data;
  try {
    await requireRole("manager");
    await settings.saveCoverholder(await createUserClient(), input, id ?? undefined);
  } catch (error) {
    return failure(error);
  }
  return done("/settings/lists", `${input.name} saved.`);
}

export async function saveReferenceAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const parsed = referenceSchema.safeParse(formToObject(form, { booleans: ["is_active"], numbers: ["sort_order"] }));
  if (!parsed.success) return invalid(parsed.error);
  const { table, ...row } = parsed.data;
  try {
    await requireRole("manager");
    await settings.saveReference(await createUserClient(), table, row);
  } catch (error) {
    return failure(error);
  }
  return done("/settings/lists", `${row.label} saved.`);
}

/** Invites a user by email (Supabase sends the link) and gives them an active profile with a role. */
export async function inviteUserAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const parsed = inviteSchema.safeParse(formToObject(form));
  if (!parsed.success) return invalid(parsed.error);
  const { email, display_name, role } = parsed.data;
  try {
    await requireRole("manager");
    const admin = createServiceClient();
    const origin = originFrom(await headers());
    const invited = await admin.auth.admin.inviteUserByEmail(email, { redirectTo: `${origin}/auth/callback` });
    let userId = invited.data.user?.id;
    if (!userId) {
      // Already a user (for example invited before): find them and just (re)activate the profile.
      const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
      userId = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())?.id;
    }
    if (!userId) throw new DataError("The invitation could not be sent. Please try again.", "unexpected");
    await settings.saveProfile(await createUserClient(), userId, { display_name, email, role, is_active: true });
  } catch (error) {
    return failure(error);
  }
  return done("/settings/users", `Invitation sent and access granted to ${display_name}.`);
}

export async function updateUserAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const parsed = profileUpdateSchema.safeParse(formToObject(form, { booleans: ["is_active"] }));
  if (!parsed.success) return invalid(parsed.error);
  try {
    const me = await requireRole("manager");
    if (parsed.data.id === me.id && (!parsed.data.is_active || parsed.data.role !== "manager")) {
      return { ok: false, message: "You cannot remove your own Manager access. Ask another Manager." };
    }
    const db = await createUserClient();
    const current = await settings.getProfile(db, parsed.data.id);
    if (!current) throw new DataError("User not found.", "not_found");
    await settings.saveProfile(db, parsed.data.id, { ...parsed.data, email: current.email });
  } catch (error) {
    return failure(error);
  }
  return done("/settings/users", `${parsed.data.display_name} updated.`);
}

export async function refreshBankHolidaysAction(_prev: ActionResult): Promise<ActionResult> {
  try {
    await requireRole("manager");
    const response = await fetch(GOV_UK_BANK_HOLIDAYS_URL, { cache: "no-store" });
    if (!response.ok) return { ok: false, message: "gov.uk could not be reached. Please try again later." };
    const rows = parseGovUkBankHolidays(await response.json());
    const count = await settings.upsertBankHolidays(await createUserClient(), rows);
    return done("/settings/holidays", `${count} England and Wales bank holidays loaded from gov.uk.`);
  } catch (error) {
    return failure(error);
  }
}

export async function addBankHolidayAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const parsed = holidaySchema.safeParse(formToObject(form));
  if (!parsed.success) return invalid(parsed.error);
  try {
    await requireRole("manager");
    await settings.upsertBankHolidays(await createUserClient(), [{ ...parsed.data, region: BANK_HOLIDAY_REGION }]);
  } catch (error) {
    return failure(error);
  }
  return done("/settings/holidays", "Bank holiday saved.");
}

export async function removeBankHolidayAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const parsed = holidaySchema.pick({ date: true }).safeParse(formToObject(form));
  if (!parsed.success) return invalid(parsed.error);
  try {
    await requireRole("manager");
    await settings.deleteBankHoliday(await createUserClient(), BANK_HOLIDAY_REGION, parsed.data.date);
  } catch (error) {
    return failure(error);
  }
  return done("/settings/holidays", "Bank holiday removed.");
}
