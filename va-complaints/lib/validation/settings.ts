import { z } from "zod";
import { REFERENCE_TABLES, ROLES } from "@/lib/domain/complaint";
import { isIsoDate } from "@/lib/rules";

const text = (max: number, message: string) => z.string().trim().min(1, { message }).max(max);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((v) => (v ? v : null));

/** An optional SLA override: a whole number from 1 to 3650, or empty for "use the default". */
const slaValue = z
  .number({ message: "Enter a whole number" })
  .int({ message: "Enter a whole number" })
  .min(1, { message: "Must be at least 1" })
  .max(3650, { message: "Too large" })
  .nullable()
  .optional()
  .transform((v) => v ?? null);

export const SLA_FIELDS = [
  "ack_business_days",
  "summary_business_days",
  "interim_days",
  "final_response_days",
  "fos_referral_days",
  "amber_window_days",
  "retention_years",
] as const;

const slaShape = Object.fromEntries(SLA_FIELDS.map((f) => [f, slaValue])) as Record<(typeof SLA_FIELDS)[number], typeof slaValue>;

export const firmSettingsSchema = z.object({
  firm_name: text(200, "Enter the firm name"),
  firm_short_name: text(100, "Enter the short name"),
  bank_holidays_enabled: z.boolean(),
  fos_wording: optionalText(10_000),
  lloyds_wording: optionalText(10_000),
  fos_contact: optionalText(2_000),
  ...slaShape,
});

export const insurerSchema = z.object({
  id: z.uuid().nullable().optional(),
  name: text(200, "Enter the insurer name"),
  is_active: z.boolean(),
  is_lloyds: z.boolean(),
  ...slaShape,
});

export const coverholderSchema = z.object({
  id: z.uuid().nullable().optional(),
  name: text(200, "Enter the coverholder name"),
  is_active: z.boolean(),
});

export const referenceSchema = z.object({
  table: z.enum(REFERENCE_TABLES),
  code: z
    .string()
    .trim()
    .min(1, { message: "Enter a code" })
    .max(100)
    .regex(/^[A-Za-z0-9_&/-]+$/, { message: "Use letters, digits, _ & / or - only" }),
  label: text(200, "Enter a label"),
  sort_order: z.number({ message: "Enter a number" }).int().min(0).max(100_000).nullable().transform((v) => v ?? 0),
  is_active: z.boolean(),
});

export const inviteSchema = z.object({
  email: z.email({ message: "Enter a valid email address" }).max(320),
  display_name: text(200, "Enter the person's name"),
  role: z.enum(ROLES),
});

export const profileUpdateSchema = z.object({
  id: z.uuid(),
  display_name: text(200, "Enter the person's name"),
  role: z.enum(ROLES),
  is_active: z.boolean(),
});

export const holidaySchema = z.object({
  date: z.string().refine(isIsoDate, { message: "Enter a valid date" }),
  name: text(200, "Enter the holiday name"),
});
