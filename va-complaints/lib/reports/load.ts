import "server-only";
import { buildView } from "@/lib/complaints/view";
import type { Db } from "@/lib/db/client";
import { listComplaints } from "@/lib/db/complaints";
import { loadContext } from "@/lib/db/context";
import { isAfter, isIsoDate, type IsoDate, todayUtc } from "@/lib/rules";
import { buildMiReport, defaultPeriod, insurerOptions, type MiReport, parseInsurerFilter } from "./mi";

/** Report period from query parameters; defaults to the last 12 months up to today. */
export function reportPeriod(params: { from?: string | null; to?: string | null }, today: IsoDate = todayUtc()): { from: IsoDate; to: IsoDate } {
  const to = params.to && isIsoDate(params.to) && !isAfter(params.to, today) ? params.to : today;
  const fallbackFrom = defaultPeriod(to).from;
  const from = params.from && isIsoDate(params.from) && !isAfter(params.from, to) ? params.from : fallbackFrom;
  return { from, to };
}

/** The report and the insurer names that can be filtered on. Filtering happens here, for the page and the export alike. */
export async function loadMiReport(
  db: Db,
  from: IsoDate,
  to: IsoDate,
  insurerParam?: string | string[] | null,
): Promise<{ report: MiReport; insurerOptions: string[] }> {
  const [ctx, complaints] = await Promise.all([loadContext(db), listComplaints(db)]);
  const today = todayUtc();
  const views = complaints.map((c) => buildView(c, ctx, today));
  const options = insurerOptions(views);
  const map = (rows: { code: string; label: string }[]) => new Map(rows.map((r) => [r.code, r.label]));
  const report = buildMiReport(
    views,
    from,
    to,
    {
      product: map(ctx.refs.ref_product),
      nature: map(ctx.refs.ref_nature_of_complaint),
      rootCause: map(ctx.refs.ref_root_cause),
      firmShortName: ctx.firm?.firm_short_name ?? "Firm",
    },
    parseInsurerFilter(insurerParam, options),
  );
  return { report, insurerOptions: options };
}
