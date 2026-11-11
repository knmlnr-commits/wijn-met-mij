"use client";

import { useId } from "react";
import { useFormStatus } from "react-dom";
import type { ActionResult } from "@/lib/actions/state";

/** Small form building blocks shared by every screen. */

export function FieldError({ result, name }: { result: ActionResult; name: string }) {
  const message = result.fieldErrors?.[name];
  return message ? (
    <span className="field-error" id={`${name}-error`}>
      {message}
    </span>
  ) : null;
}

export function FormMessage({ result }: { result: ActionResult }) {
  if (!result.message) return null;
  return (
    <p className={`form-message ${result.ok ? "ok" : "error"}`} role={result.ok ? "status" : "alert"}>
      {result.message}
    </p>
  );
}

export function SubmitButton({ children, variant = "primary" }: { children: React.ReactNode; variant?: "primary" | "secondary" }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={variant === "primary" ? "button-primary" : "button-secondary"} disabled={pending}>
      {pending ? "Saving..." : children}
    </button>
  );
}

export interface Option {
  value: string;
  label: string;
}

interface FieldProps {
  name: string;
  label: string;
  result: ActionResult;
  required?: boolean;
  className?: string;
}

export function TextField({
  name,
  label,
  result,
  required,
  className,
  type = "text",
  defaultValue,
  ...rest
}: FieldProps & { type?: string; defaultValue?: string | number | null; maxLength?: number; inputMode?: "decimal" | "text"; max?: string }) {
  // Unique per instance: the same field name appears in several action forms on one page.
  const id = `${useId()}-${name}`;
  return (
    <div className={`field ${className ?? ""}`}>
      <label htmlFor={id}>
        {label}
        {required ? " (required)" : ""}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue ?? ""}
        aria-invalid={Boolean(result.fieldErrors?.[name])}
        aria-describedby={result.fieldErrors?.[name] ? `${name}-error` : undefined}
        {...rest}
      />
      <FieldError result={result} name={name} />
    </div>
  );
}

export function TextArea({ name, label, result, required, className, defaultValue }: FieldProps & { defaultValue?: string | null }) {
  const id = `${useId()}-${name}`;
  return (
    <div className={`field ${className ?? ""}`}>
      <label htmlFor={id}>
        {label}
        {required ? " (required)" : ""}
      </label>
      <textarea id={id} name={name} required={required} defaultValue={defaultValue ?? ""} aria-invalid={Boolean(result.fieldErrors?.[name])} />
      <FieldError result={result} name={name} />
    </div>
  );
}

export function SelectField({
  name,
  label,
  result,
  required,
  className,
  options,
  defaultValue,
  emptyLabel = "Not set",
  onChange,
}: FieldProps & {
  options: Option[];
  defaultValue?: string | null;
  emptyLabel?: string;
  onChange?: (value: string) => void;
}) {
  const id = `${useId()}-${name}`;
  return (
    <div className={`field ${className ?? ""}`}>
      <label htmlFor={id}>
        {label}
        {required ? " (required)" : ""}
      </label>
      <select
        id={id}
        name={name}
        required={required}
        defaultValue={defaultValue ?? ""}
        aria-invalid={Boolean(result.fieldErrors?.[name])}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
      >
        <option value="">{options.length === 0 ? "No values yet (list awaiting set up)" : emptyLabel}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <FieldError result={result} name={name} />
    </div>
  );
}

export function YesNoField({ name, label, result, defaultValue }: FieldProps & { defaultValue?: boolean | null }) {
  const value = defaultValue === true ? "yes" : defaultValue === false ? "no" : "";
  return (
    <div className="field">
      <fieldset>
        <legend>{label}</legend>
        <label className="check">
          <input type="radio" name={name} value="yes" defaultChecked={value === "yes"} /> Yes
        </label>
        <label className="check">
          <input type="radio" name={name} value="no" defaultChecked={value === "no"} /> No
        </label>
      </fieldset>
      <FieldError result={result} name={name} />
    </div>
  );
}

export function CheckboxField({ name, label, defaultChecked, onChange }: { name: string; label: string; defaultChecked?: boolean; onChange?: (v: boolean) => void }) {
  return (
    <label className="check">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} onChange={onChange ? (e) => onChange(e.target.checked) : undefined} />
      {label}
    </label>
  );
}
