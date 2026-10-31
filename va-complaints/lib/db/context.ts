import "server-only";
import type { ViewContext } from "@/lib/complaints/view";
import { REFERENCE_TABLES, type ReferenceTable } from "@/lib/domain/complaint";
import type { Db } from "./client";
import { getFirmSettings, listBankHolidays, listCoverholders, listInsurers, listProfiles, listReference } from "./settings";
import type { CoverholderRow, ReferenceRow } from "./types";

export interface AppContext extends ViewContext {
  coverholders: CoverholderRow[];
  refs: Record<ReferenceTable, ReferenceRow[]>;
}

/** Settings, insurers, holidays, users and reference lists for one request, read under RLS. */
export async function loadContext(db: Db): Promise<AppContext> {
  const [firm, insurers, holidays, profiles, coverholders, ...lists] = await Promise.all([
    getFirmSettings(db),
    listInsurers(db),
    listBankHolidays(db),
    listProfiles(db),
    listCoverholders(db),
    ...REFERENCE_TABLES.map((t) => listReference(db, t)),
  ]);
  const refs = Object.fromEntries(REFERENCE_TABLES.map((t, i) => [t, lists[i]])) as Record<ReferenceTable, ReferenceRow[]>;
  return { firm, insurers, holidays, profiles, coverholders, refs };
}

/** Label for a reference code, falling back to the code itself. */
export function refLabel(ctx: AppContext, table: ReferenceTable, code: string | null): string {
  if (!code) return "Not set";
  return ctx.refs[table].find((r) => r.code === code)?.label ?? code;
}
