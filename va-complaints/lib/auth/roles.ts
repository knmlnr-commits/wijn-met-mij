import type { Role } from "@/lib/domain/complaint";

export interface CurrentUser {
  id: string;
  email: string;
  displayName: string;
  role: Role;
}

export class AuthError extends Error {
  constructor(readonly kind: "unauthenticated" | "forbidden") {
    super(kind === "unauthenticated" ? "Please sign in." : "You do not have permission to do this.");
    this.name = "AuthError";
  }
}

/** Throws unless there is an active user holding one of the roles. */
export function assertRole(user: CurrentUser | null, roles: readonly Role[]): CurrentUser {
  if (!user) throw new AuthError("unauthenticated");
  if (!roles.includes(user.role)) throw new AuthError("forbidden");
  return user;
}

export const can = {
  writeComplaints: (role: Role) => role === "handler" || role === "manager",
  manage: (role: Role) => role === "manager",
};
