import type { Role } from "@/lib/domain/complaint";

export interface CurrentUser {
  id: string;
  email: string;
  displayName: string;
  role: Role;
}

/** Signed out; signed in without an active profile (no access); or an active user. */
export type SessionState =
  | { kind: "anonymous" }
  | { kind: "no_access" }
  | { kind: "active"; user: CurrentUser };

export class AuthError extends Error {
  constructor(readonly kind: "unauthenticated" | "forbidden") {
    super(kind === "unauthenticated" ? "Please sign in." : "You do not have permission to do this.");
    this.name = "AuthError";
  }
}

interface ProfileLike {
  id: string;
  display_name: string;
  email: string;
  role: Role;
  is_active: boolean;
}

/** The role comes from the profile only; a login without an active profile has no access. */
export function sessionStateFrom(authUserId: string | null, profile: ProfileLike | null): SessionState {
  if (!authUserId) return { kind: "anonymous" };
  if (!profile || profile.id !== authUserId || !profile.is_active) return { kind: "no_access" };
  return {
    kind: "active",
    user: { id: profile.id, email: profile.email, displayName: profile.display_name, role: profile.role },
  };
}

/** Throws unless there is an active user holding one of the roles. */
export function assertRole(user: CurrentUser | null, roles: readonly Role[]): CurrentUser {
  if (!user) throw new AuthError("unauthenticated");
  if (!roles.includes(user.role)) throw new AuthError("forbidden");
  return user;
}

export const ROLE_LABELS: Record<Role, string> = {
  handler: "Handler",
  manager: "Manager",
  compliance: "Compliance",
};

export const can = {
  writeComplaints: (role: Role) => role === "handler" || role === "manager",
  manage: (role: Role) => role === "manager",
};
