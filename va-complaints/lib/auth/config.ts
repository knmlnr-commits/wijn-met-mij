import type { Role } from "@/lib/domain/complaint";

export interface AuthConfig {
  /** Seeded dev login buttons. Never available on a production deployment, whatever the flag says. */
  devLogin: boolean;
  /** Microsoft Entra ID sign in through the Supabase Azure provider. */
  entra: boolean;
}

type Env = Record<string, string | undefined>;

export function authConfig(env: Env = process.env): AuthConfig {
  return {
    devLogin: env.NEXT_PUBLIC_DEV_LOGIN === "true" && env.VERCEL_ENV !== "production",
    entra: env.AUTH_ENTRA_ENABLED === "true",
  };
}

/** Demo accounts created by `npm run seed:demo` (example.test is a reserved domain). */
export const DEMO_ACCOUNTS: Record<Role, { email: string; displayName: string }> = {
  handler: { email: "handler@example.test", displayName: "Demo Handler" },
  manager: { email: "manager@example.test", displayName: "Demo Manager" },
  compliance: { email: "compliance@example.test", displayName: "Demo Compliance" },
};
