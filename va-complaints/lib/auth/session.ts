import "server-only";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import type { Role } from "@/lib/domain/complaint";
import { createUserClient } from "@/lib/db/client";
import { getProfile } from "@/lib/db/settings";
import { assertRole, type CurrentUser, type SessionState, sessionStateFrom } from "./roles";

/** Session and profile for this request; memoised so layout and page share one lookup. */
export const getSessionState = cache(async (): Promise<SessionState> => {
  await connection();
  const db = await createUserClient();
  const { data, error } = await db.auth.getUser();
  if (error || !data.user) return { kind: "anonymous" };
  return sessionStateFrom(data.user.id, await getProfile(db, data.user.id));
});

/** The signed in user with an active profile, or null. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const state = await getSessionState();
  return state.kind === "active" ? state.user : null;
}

/**
 * Server side role check for every server action and route handler. RLS enforces the same
 * rules in the database; this check gives a clear error before any data is touched.
 */
export async function requireRole(...roles: Role[]): Promise<CurrentUser> {
  return assertRole(await getCurrentUser(), roles);
}

/** For pages: sends the visitor to sign in, to the no access page, or on to the page. */
export async function requirePageUser(...roles: Role[]): Promise<CurrentUser> {
  const state = await getSessionState();
  if (state.kind === "anonymous") redirect("/login");
  if (state.kind === "no_access") redirect("/no-access");
  if (roles.length > 0 && !roles.includes(state.user.role)) redirect("/no-access?reason=role");
  return state.user;
}
