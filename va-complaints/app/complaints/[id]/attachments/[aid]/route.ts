import { NextResponse } from "next/server";
import { AuthError } from "@/lib/auth/roles";
import { requireRole } from "@/lib/auth/session";
import { type AttachmentFile, getAttachmentFile } from "@/lib/db/attachments";
import { createUserClient } from "@/lib/db/client";
import { DataError } from "@/lib/db/errors";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Downloads one attachment, under the user's own rights. Always as a download, never shown inline. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string; aid: string }> }) {
  try {
    await requireRole("handler", "manager", "compliance");
  } catch (error) {
    const status = error instanceof AuthError && error.kind === "forbidden" ? 403 : 401;
    return new NextResponse("Not permitted", { status });
  }
  const { id, aid } = await params;
  if (!UUID.test(id) || !UUID.test(aid)) return new NextResponse("Not found", { status: 404 });

  let file: AttachmentFile;
  try {
    file = await getAttachmentFile(await createUserClient(), aid);
  } catch (error) {
    if (error instanceof DataError && error.kind === "not_found") return new NextResponse("Not found", { status: 404 });
    throw error;
  }
  if (file.complaintId !== id) return new NextResponse("Not found", { status: 404 });

  return new NextResponse(new Uint8Array(file.bytes), {
    headers: {
      "Content-Type": file.contentType,
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store",
    },
  });
}
