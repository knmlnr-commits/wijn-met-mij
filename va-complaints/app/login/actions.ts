"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { authConfig, DEMO_ACCOUNTS } from "@/lib/auth/config";
import { originFrom, safeNextPath } from "@/lib/auth/redirect";
import { createUserClient } from "@/lib/db/client";
import { ROLES } from "@/lib/domain/complaint";

export interface LoginState {
  status: "idle" | "error" | "sent";
  message: string;
}

const email = z.email().max(320);
const next = z.string().max(2000).optional();

// Messages are deliberately generic: they never reveal whether an address has an account.
const SIGN_IN_FAILED: LoginState = { status: "error", message: "Email or password is incorrect, or the account has no access." };

export async function signInWithPassword(_prev: LoginState, form: FormData): Promise<LoginState> {
  const parsed = z
    .object({ email, password: z.string().min(1).max(200), next })
    .safeParse({ email: form.get("email"), password: form.get("password"), next: form.get("next") ?? undefined });
  if (!parsed.success) return { status: "error", message: "Enter your email address and password." };

  const db = await createUserClient();
  const { error } = await db.auth.signInWithPassword({ email: parsed.data.email, password: parsed.data.password });
  if (error) return SIGN_IN_FAILED;
  redirect(safeNextPath(parsed.data.next));
}

export async function sendMagicLink(_prev: LoginState, form: FormData): Promise<LoginState> {
  const parsed = z.object({ email, next }).safeParse({ email: form.get("email"), next: form.get("next") ?? undefined });
  if (!parsed.success) return { status: "error", message: "Enter a valid email address." };

  const origin = originFrom(await headers());
  const callback = `${origin}/auth/callback?next=${encodeURIComponent(safeNextPath(parsed.data.next))}`;
  const db = await createUserClient();
  // shouldCreateUser false: only invited users receive a link; sign up stays disabled.
  await db.auth.signInWithOtp({ email: parsed.data.email, options: { shouldCreateUser: false, emailRedirectTo: callback } });
  return { status: "sent", message: "If this address belongs to an invited user, a sign in link is on its way." };
}

export async function signInWithMicrosoft(form: FormData): Promise<void> {
  if (!authConfig().entra) redirect("/login");
  const origin = originFrom(await headers());
  const target = safeNextPath(typeof form.get("next") === "string" ? (form.get("next") as string) : null);
  const db = await createUserClient();
  const { data, error } = await db.auth.signInWithOAuth({
    provider: "azure",
    options: { scopes: "email", redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(target)}` },
  });
  if (error || !data.url) redirect("/login?error=provider");
  redirect(data.url);
}

/** Sandbox only: sign in as a seeded demo user. Checked here as well as hidden in the UI. */
export async function devSignIn(_prev: LoginState, form: FormData): Promise<LoginState> {
  if (!authConfig().devLogin) return { status: "error", message: "Dev login is not available." };
  const role = z.enum(ROLES).safeParse(form.get("role"));
  const password = process.env.DEMO_USER_PASSWORD;
  if (!role.success || !password) return { status: "error", message: "Dev login is not configured." };

  const db = await createUserClient();
  const { error } = await db.auth.signInWithPassword({ email: DEMO_ACCOUNTS[role.data].email, password });
  if (error) return { status: "error", message: "Dev login failed. Run npm run seed:demo first." };
  redirect(safeNextPath(typeof form.get("next") === "string" ? (form.get("next") as string) : null));
}
