import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { authConfig } from "@/lib/auth/config";
import { safeNextPath } from "@/lib/auth/redirect";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { getSessionState } from "@/lib/auth/session";
import { ROLES } from "@/lib/domain/complaint";
import { LoginForm } from "./LoginForm";
import styles from "./login.module.css";

export const metadata: Metadata = { title: "Sign in | Van Ameyde Complaints Management" };

const NOTICES: Record<string, string> = {
  link: "That sign in link is invalid or has expired. Please request a new one.",
  provider: "Microsoft sign in is not available right now. Please try again or use another method.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const next = safeNextPath(typeof params.next === "string" ? params.next : null);

  const state = await getSessionState();
  if (state.kind === "active") redirect(next);
  if (state.kind === "no_access") redirect("/no-access");

  const config = authConfig();
  const error = typeof params.error === "string" ? params.error : null;

  return (
    <section className={styles.card}>
      <h1>Sign in</h1>
      <p className={styles.hint}>For invited Van Ameyde users only.</p>
      <LoginForm
        next={next}
        entra={config.entra}
        devAccounts={config.devLogin ? ROLES.map((role) => ({ role, label: ROLE_LABELS[role] })) : null}
        notice={error ? (NOTICES[error] ?? null) : null}
      />
    </section>
  );
}
