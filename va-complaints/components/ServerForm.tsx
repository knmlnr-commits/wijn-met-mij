"use client";

import { useActionState } from "react";
import { IDLE, type ActionResult } from "@/lib/actions/state";
import { FormMessage, SubmitButton } from "./forms";

/**
 * A form bound to a server action, showing its result and validation messages. The inputs are
 * passed as children, so server pages can render them directly.
 */
export function ServerForm({
  action,
  submit,
  children,
  className,
  variant = "primary",
}: {
  action: (prev: ActionResult, form: FormData) => Promise<ActionResult>;
  submit: string;
  children?: React.ReactNode;
  className?: string;
  variant?: "primary" | "secondary";
}) {
  const [result, run] = useActionState(action, IDLE);
  return (
    <form action={run} className={className ?? "stack"}>
      {children}
      {result.fieldErrors && (
        <ul className="field-error">
          {Object.entries(result.fieldErrors).map(([field, message]) => (
            <li key={field}>{message}</li>
          ))}
        </ul>
      )}
      <FormMessage result={result} />
      <div className="button-row">
        <SubmitButton variant={variant}>{submit}</SubmitButton>
      </div>
    </form>
  );
}
