import { type NextRequest, NextResponse } from "next/server";
import { createUserClient } from "@/lib/db/client";

export async function POST(request: NextRequest) {
  const db = await createUserClient();
  await db.auth.signOut();
  return NextResponse.redirect(new URL("/login", request.nextUrl.origin), { status: 303 });
}
