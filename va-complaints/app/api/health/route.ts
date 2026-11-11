import { NextResponse } from "next/server";
import { APP_VERSION } from "@/lib/changelog";
import { appVersion } from "@/lib/version";

/** Liveness check for the platform team. No database call and no data; safe without a session. */
export function GET() {
  const { sha, env } = appVersion();
  return NextResponse.json({ status: "ok", version: APP_VERSION, build: sha, environment: env }, { headers: { "Cache-Control": "no-store" } });
}
