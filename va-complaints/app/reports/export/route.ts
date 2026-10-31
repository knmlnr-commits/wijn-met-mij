import { type NextRequest, NextResponse } from "next/server";
import { AuthError } from "@/lib/auth/roles";
import { requireRole } from "@/lib/auth/session";
import { createUserClient } from "@/lib/db/client";
import { loadMiReport, reportPeriod } from "@/lib/reports/load";
import { miReportCsv } from "@/lib/reports/mi";

/** DISP 1.10 MI as CSV. Aggregates only: no personal data in the export. */
export async function GET(request: NextRequest) {
  try {
    await requireRole("handler", "manager", "compliance");
  } catch (error) {
    const status = error instanceof AuthError && error.kind === "forbidden" ? 403 : 401;
    return new NextResponse("Not permitted", { status });
  }
  const { from, to } = reportPeriod({ from: request.nextUrl.searchParams.get("from"), to: request.nextUrl.searchParams.get("to") });
  const db = await createUserClient();
  const csv = miReportCsv(await loadMiReport(db, from, to));
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="complaints-mi-${from}-to-${to}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
