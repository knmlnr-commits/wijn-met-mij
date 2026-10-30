import { z } from "zod";
import { ELIGIBILITY, MANUAL_STATUSES, OUTCOMES, PARTIES } from "@/lib/domain/complaint";
import { isAfter, isIsoDate, todayUtc } from "@/lib/rules";

/**
 * Input validation for every server action. Error messages never echo the submitted value, so
 * no personal data reaches logs or error output.
 */

const trimmed = (max: number) => z.string().trim().max(max);
const optionalText = (max: number) =>
  trimmed(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

const isoDate = z.string().refine(isIsoDate, { message: "Enter a valid date" });
const pastOrToday = (today: string) =>
  isoDate.refine((d) => !isAfter(d, today), { message: "Date cannot be in the future" });
const optionalPastDate = (today: string) =>
  pastOrToday(today)
    .optional()
    .nullable()
    .or(z.literal("").transform(() => null))
    .transform((v) => v ?? null);

/** Pounds and pence: non negative, at most two decimals. */
export const gbpAmount = z
  .number({ message: "Enter an amount" })
  .nonnegative({ message: "Amount cannot be negative" })
  .max(9_999_999_999.99)
  .refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6, { message: "Use at most two decimals" });

const uuid = z.uuid({ message: "Invalid identifier" });
const optionalUuid = uuid.optional().nullable().or(z.literal("").transform(() => null)).transform((v) => v ?? null);
const optionalCode = optionalText(100);

function detailFields(today: string) {
  return {
    handler_id: optionalUuid,
    complainant_type: optionalCode,
    complainant_name: trimmed(200).min(1, { message: "Enter the complainant's name" }),
    complainant_email: z
      .email({ message: "Enter a valid email address" })
      .max(320)
      .optional()
      .nullable()
      .or(z.literal("").transform(() => null))
      .transform((v) => v ?? null),
    complainant_phone: optionalText(50),
    address_line1: optionalText(200),
    address_line2: optionalText(200),
    town: optionalText(100),
    county: optionalText(100),
    postcode: optionalText(20),
    country: optionalText(100),
    coverholder_id: optionalUuid,
    product: optionalCode,
    channel: optionalCode,
    claim_related: z.boolean().optional().nullable().transform((v) => v ?? null),
    claim_reference: optionalText(100),
    insurer_complaint_reference: optionalText(100),
    eligibility: z.enum(ELIGIBILITY).optional().nullable().transform((v) => v ?? null),
    nature_of_complaint: optionalCode,
    root_cause: optionalCode,
    secondary_cause: optionalCode,
    received_into_complaints_date: optionalPastDate(today),
    summary: trimmed(10_000).min(1, { message: "Enter a summary of the complaint" }),
    findings: optionalText(20_000),
    // No default here: a partial edit must never reset the flag. Registration adds the default.
    vulnerable_customer: z.boolean(),
    vulnerability_category: optionalCode,
  };
}

const vulnerabilityRule = {
  check: (v: { vulnerable_customer?: boolean; vulnerability_category?: string | null }) =>
    !v.vulnerable_customer || Boolean(v.vulnerability_category),
  issue: { message: "Choose a vulnerability category", path: ["vulnerability_category"] },
};

export function registerComplaintSchema(today: string = todayUtc()) {
  return z
    .object({
      insurer_id: uuid,
      received_date: pastOrToday(today),
      ...detailFields(today),
      vulnerable_customer: z.boolean().default(false),
    })
    .refine(vulnerabilityRule.check, vulnerabilityRule.issue)
    .refine((v) => !v.received_into_complaints_date || !isAfter(v.received_date, v.received_into_complaints_date), {
      message: "Cannot be before the received date",
      path: ["received_into_complaints_date"],
    });
}
export type RegisterComplaintInput = z.output<ReturnType<typeof registerComplaintSchema>>;

/** Partial edit of descriptive fields. Unknown keys (received date, insurer, status) are rejected. */
export function updateDetailsSchema(today: string = todayUtc()) {
  return z
    .object(detailFields(today))
    .partial()
    .strict()
    .refine((v) => Object.keys(v).length > 0, { message: "Nothing to update" })
    .refine((v) => v.vulnerable_customer !== true || Boolean(v.vulnerability_category), vulnerabilityRule.issue);
}
export type UpdateDetailsInput = z.output<ReturnType<typeof updateDetailsSchema>>;

export const complaintIdSchema = z.object({ complaintId: uuid });

export function actionDateSchema(today: string = todayUtc()) {
  return z.object({ complaintId: uuid, date: pastOrToday(today) });
}

export const setStatusSchema = z.object({ complaintId: uuid, status: z.enum(MANUAL_STATUSES) });

export function finalResponseSchema(today: string = todayUtc()) {
  return z
    .object({
      complaintId: uuid,
      date: pastOrToday(today),
      outcome: z.enum(OUTCOMES),
      upheldAgainst: z.enum(PARTIES).optional().nullable().transform((v) => v ?? null),
      compensationAmount: gbpAmount.optional().nullable().transform((v) => v ?? null),
      compensationPaidBy: z.enum(PARTIES).optional().nullable().transform((v) => v ?? null),
      findings: optionalText(20_000),
    })
    .refine((v) => v.outcome === "not_upheld" || v.upheldAgainst !== null, {
      message: "Choose who the complaint is upheld against",
      path: ["upheldAgainst"],
    })
    .refine((v) => !v.compensationAmount || v.compensationPaidBy !== null, {
      message: "Choose who pays the compensation",
      path: ["compensationPaidBy"],
    });
}

export function referralSchema(today: string = todayUtc()) {
  return z.object({ complaintId: uuid, date: pastOrToday(today), reference: optionalText(100) });
}

export function escalationOutcomeSchema(today: string = todayUtc()) {
  return z.object({
    complaintId: uuid,
    decision: trimmed(500).min(1, { message: "Enter the decision" }),
    ombudsmanDecision: optionalText(500),
    closedDate: optionalPastDate(today),
    compensation: gbpAmount.optional().nullable().transform((v) => v ?? null),
    actionsRequired: z.boolean().default(false),
  });
}

export const compensationStatusSchema = z.object({
  complaintId: uuid,
  status: z.enum(["compensation_outstanding", "compensation_paid"]),
});

export const deletionSchema = z.object({
  complaintId: uuid,
  reason: trimmed(1000).min(1, { message: "Enter a reason" }),
});
