"use client";

import { useActionState } from "react";
import type { Role } from "@/lib/domain/complaint";
import { devSignIn, type LoginState, sendMagicLink, signInWithMicrosoft, signInWithPassword } from "./actions";
import styles from "./login.module.css";

const IDLE: LoginState = { status: "idle", message: "" };

interface Props {
  next: string;
  entra: boolean;
  devAccounts: { role: Role; label: string }[] | null;
  notice: string | null;
}

export function LoginForm({ next, entra, devAccounts, notice }: Props) {
  const [passwordState, passwordAction, passwordPending] = useActionState(signInWithPassword, IDLE);
  const [linkState, linkAction, linkPending] = useActionState(sendMagicLink, IDLE);
  const [devState, devAction, devPending] = useActionState(devSignIn, IDLE);

  return (
    <div className={styles.stack}>
      {notice && (
        <p className={styles.error} role="alert">
          {notice}
        </p>
      )}

      {entra && (
        <form action={signInWithMicrosoft}>
          <input type="hidden" name="next" value={next} />
          <button className={styles.primary} type="submit">
            Sign in with Microsoft
          </button>
        </form>
      )}

      <form action={passwordAction} className={styles.form} aria-labelledby="password-heading">
        <h2 id="password-heading">Sign in with your password</h2>
        <input type="hidden" name="next" value={next} />
        <label>
          Email address
          <input name="email" type="email" autoComplete="username" required />
        </label>
        <label>
          Password
          <input name="password" type="password" autoComplete="current-password" required />
        </label>
        {passwordState.status === "error" && (
          <p className={styles.error} role="alert">
            {passwordState.message}
          </p>
        )}
        <button className={entra ? styles.secondary : styles.primary} type="submit" disabled={passwordPending}>
          {passwordPending ? "Signing in..." : "Sign in"}
        </button>
      </form>

      <form action={linkAction} className={styles.form} aria-labelledby="link-heading">
        <h2 id="link-heading">Or get a sign in link by email</h2>
        <input type="hidden" name="next" value={next} />
        <label>
          Email address
          <input name="email" type="email" autoComplete="email" required />
        </label>
        {linkState.status !== "idle" && (
          <p className={linkState.status === "sent" ? styles.info : styles.error} role="status">
            {linkState.message}
          </p>
        )}
        <button className={styles.secondary} type="submit" disabled={linkPending}>
          {linkPending ? "Sending..." : "Email me a link"}
        </button>
      </form>

      {devAccounts && (
        <form action={devAction} className={styles.dev} aria-labelledby="dev-heading">
          <h2 id="dev-heading">Dev login</h2>
          <p className={styles.hint}>Sandbox only. Signs in as a seeded demo user with synthetic data.</p>
          <input type="hidden" name="next" value={next} />
          <div className={styles.devButtons}>
            {devAccounts.map((a) => (
              <button key={a.role} className={styles.secondary} type="submit" name="role" value={a.role} disabled={devPending}>
                {a.label}
              </button>
            ))}
          </div>
          {devState.status === "error" && (
            <p className={styles.error} role="alert">
              {devState.message}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
