import { NextResponse } from "next/server";
import { AuthError } from "@/lib/auth/roles";
import { requireRole } from "@/lib/auth/session";
import { createUserClient } from "@/lib/db/client";
import { DataError } from "@/lib/db/errors";
import { getNotification } from "@/lib/db/notifications";
import type { NotificationRow } from "@/lib/db/types";
import { letterPdf, letterPdfFileName } from "@/lib/letters/pdf";
import { splitStoredLetter } from "@/lib/letters/stored";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A stored letter as a PDF download. Read under the user's own rights (RLS), like the letter page. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string; nid: string }> }) {
  try {
    await requireRole("handler", "manager", "compliance");
  } catch (error) {
    const status = error instanceof AuthError && error.kind === "forbidden" ? 403 : 401;
    return new NextResponse("Not permitted", { status });
  }
  const { id, nid } = await params;
  if (!UUID.test(id) || !UUID.test(nid)) return new NextResponse("Not found", { status: 404 });

  let n: NotificationRow;
  try {
    n = await getNotification(await createUserClient(), nid);
  } catch (error) {
    if (error instanceof DataError && error.kind === "not_found") return new NextResponse("Not found", { status: 404 });
    throw error;
  }
  if (n.complaint_id !== id) return new NextResponse("Not found", { status: 404 });

  const draft = n.status !== "sent";
  const pdf = await letterPdf({ ...splitStoredLetter(n.rendered_content), draft });
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${letterPdfFileName(n.type, n.sent_at ?? n.created_at, draft)}"`,
      "Cache-Control": "no-store",
    },
  });
}
