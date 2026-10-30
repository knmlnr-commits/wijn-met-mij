import "server-only";
import type { ReferenceTable, Role } from "@/lib/domain/complaint";
import type { Db } from "./client";
import { check, DataError } from "./errors";
import type {
  BankHolidayRow,
  CoverholderRow,
  FirmSettingsRow,
  InsurerRow,
  ProfileRow,
  ReferenceRow,
  SlaColumns,
} from "./types";

/**
 * Settings, insurers, coverholders, reference lists, bank holidays and users. Writes are
 * limited to Managers by RLS; server actions also call requireRole("manager") first.
 */

export async function getFirmSettings(db: Db): Promise<FirmSettingsRow> {
  const row = check(await db.from("firm_settings").select("*").maybeSingle()) as FirmSettingsRow | null;
  if (!row) throw new DataError("Firm settings are not configured.", "not_found");
  return row;
}

export type FirmSettingsUpdate = Partial<
  Pick<FirmSettingsRow, "firm_name" | "firm_short_name" | "bank_holidays_enabled" | "fos_wording" | "lloyds_wording" | "fos_contact">
> &
  Partial<SlaColumns>;

export async function updateFirmSettings(db: Db, patch: FirmSettingsUpdate): Promise<void> {
  const updated = check(await db.from("firm_settings").update(patch).eq("id", true).select("id")) as unknown[];
  if (updated.length !== 1) throw new DataError("You do not have permission to do this.", "forbidden");
}

export async function listInsurers(db: Db, { activeOnly = false } = {}): Promise<InsurerRow[]> {
  let query = db.from("insurers").select("*").order("name");
  if (activeOnly) query = query.eq("is_active", true);
  return check(await query) as InsurerRow[];
}

export type InsurerInput = Pick<InsurerRow, "name" | "is_active" | "is_lloyds"> & Partial<SlaColumns>;

export async function saveInsurer(db: Db, input: InsurerInput, id?: string): Promise<void> {
  const result = id ? await db.from("insurers").update(input).eq("id", id).select("id") : await db.from("insurers").insert(input).select("id");
  if ((check(result) as unknown[]).length !== 1) throw new DataError("You do not have permission to do this.", "forbidden");
}

export async function listCoverholders(db: Db, { activeOnly = false } = {}): Promise<CoverholderRow[]> {
  let query = db.from("coverholders").select("*").order("name");
  if (activeOnly) query = query.eq("is_active", true);
  return check(await query) as CoverholderRow[];
}

export async function saveCoverholder(db: Db, input: Pick<CoverholderRow, "name" | "is_active">, id?: string): Promise<void> {
  const result = id
    ? await db.from("coverholders").update(input).eq("id", id).select("id")
    : await db.from("coverholders").insert(input).select("id");
  if ((check(result) as unknown[]).length !== 1) throw new DataError("You do not have permission to do this.", "forbidden");
}

export async function listReference(db: Db, table: ReferenceTable, { activeOnly = false } = {}): Promise<ReferenceRow[]> {
  let query = db.from(table).select("code, label, sort_order, is_active").order("sort_order").order("label");
  if (activeOnly) query = query.eq("is_active", true);
  return check(await query) as ReferenceRow[];
}

export async function saveReference(db: Db, table: ReferenceTable, row: ReferenceRow): Promise<void> {
  const result = await db.from(table).upsert(row, { onConflict: "code" }).select("code");
  if ((check(result) as unknown[]).length !== 1) throw new DataError("You do not have permission to do this.", "forbidden");
}

export async function listBankHolidays(db: Db): Promise<BankHolidayRow[]> {
  return check(await db.from("bank_holidays").select("date, name, region").order("date")) as BankHolidayRow[];
}

export async function listProfiles(db: Db): Promise<ProfileRow[]> {
  return check(await db.from("profiles").select("id, display_name, email, role, is_active").order("display_name")) as ProfileRow[];
}

export async function getProfile(db: Db, id: string): Promise<ProfileRow | null> {
  return check(await db.from("profiles").select("id, display_name, email, role, is_active").eq("id", id).maybeSingle()) as ProfileRow | null;
}

export async function saveProfile(
  db: Db,
  id: string,
  input: { display_name: string; email: string; role: Role; is_active: boolean },
): Promise<void> {
  const result = await db.from("profiles").upsert({ id, ...input }, { onConflict: "id" }).select("id");
  if ((check(result) as unknown[]).length !== 1) throw new DataError("You do not have permission to do this.", "forbidden");
}
