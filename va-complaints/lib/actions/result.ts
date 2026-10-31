import type { z } from "zod";
import { AuthError } from "@/lib/auth/roles";
import { PolicyError } from "@/lib/complaints/policy";
import { DataError } from "@/lib/db/errors";

import type { ActionResult } from "./state";

export type { ActionResult } from "./state";

/** First validation message per field, for showing next to the inputs. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    out[key] ??= issue.message;
  }
  return out;
}

export function invalid(error: z.ZodError): ActionResult {
  return { ok: false, message: "Please check the highlighted fields.", fieldErrors: fieldErrors(error) };
}

/** Converts known errors to a result; anything unexpected is logged without details and hidden. */
export function failure(error: unknown): ActionResult {
  if (error instanceof AuthError || error instanceof PolicyError || error instanceof DataError) {
    return { ok: false, message: error.message };
  }
  console.error("Unexpected action failure", error instanceof Error ? error.name : "unknown");
  return { ok: false, message: "Something went wrong. Please try again." };
}

/** Reads a FormData into a plain object: empty strings dropped, checkboxes and numbers converted. */
export function formToObject(
  form: FormData,
  options: { booleans?: string[]; numbers?: string[]; keepEmpty?: string[] } = {},
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of form.entries()) {
    if (key.startsWith("$ACTION")) continue;
    if (typeof value !== "string") continue;
    out[key] = value;
  }
  for (const key of options.booleans ?? []) out[key] = form.get(key) === "on" || form.get(key) === "true";
  for (const key of options.numbers ?? []) {
    const raw = form.get(key);
    out[key] = typeof raw === "string" && raw.trim() !== "" ? Number(raw.replace(/[£,\s]/g, "")) : null;
  }
  for (const [key, value] of Object.entries(out)) {
    if (value === "" && !(options.keepEmpty ?? []).includes(key)) out[key] = null;
  }
  return out;
}
