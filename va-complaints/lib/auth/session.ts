import "server-only";
import type { Role } from "@/lib/domain/complaint";
import { createUserClient } from "@/lib/db/client";
import { getProfile } from "@/lib/db/settings";
import { assertRole, type CurrentUser } from "./roles";

/** The signed in user with an active profile, or null. A login without an active profile has no access. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const db = await createUserClient();
  const { data, error } = await db.auth.getUser();
  if (error || !data.user) return null;
  const profile = await getProfile(db, data.user.id);
  if (!profile || !profile.is_active) return null;
  return { id: profile.id, email: profile.email, displayName: profile.display_name, role: profile.role };
}

/**
 * Server side role check for every server action and route handler. RLS enforces the same
 * rules in the database; this check gives a clear error before any data is touched.
 */
export async function requireRole(...roles: Role[]): Promise<CurrentUser> {
  return assertRole(await getCurrentUser(), roles);
}
