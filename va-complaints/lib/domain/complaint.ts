/**
 * Complaint codes shared by validation, the repository layer and the UI. The values match the
 * check constraints in supabase/migrations. Labels follow the specification's status list.
 */

export const ROLES = ["handler", "manager", "compliance"] as const;
export type Role = (typeof ROLES)[number];

export const STATUSES = [
  "new",
  "pending_informal_action",
  "referred_to_insurer",
  "acknowledged",
  "investigating",
  "awaiting_information",
  "draft_with_insurer",
  "resolved",
  "compensation_outstanding",
  "compensation_paid",
  "referred_to_lloyds",
  "referred_to_fos",
  "actions_required_following_decision",
  "closed",
] as const;
export type ComplaintStatus = (typeof STATUSES)[number];

export const STATUS_LABELS: Record<ComplaintStatus, string> = {
  new: "New",
  pending_informal_action: "Pending Informal Action",
  referred_to_insurer: "Referred to Insurer",
  acknowledged: "Acknowledged",
  investigating: "Investigating",
  awaiting_information: "Awaiting Information",
  draft_with_insurer: "Draft with Insurer",
  resolved: "Resolved",
  compensation_outstanding: "Compensation Outstanding",
  compensation_paid: "Compensation Paid",
  referred_to_lloyds: "Referred to Lloyd's",
  referred_to_fos: "Referred to FOS",
  actions_required_following_decision: "Actions required following FOS/Lloyd's Decision",
  closed: "Closed",
};

/** Statuses a handler sets directly; every other status follows from a workflow action. */
export const MANUAL_STATUSES = [
  "investigating",
  "awaiting_information",
  "referred_to_insurer",
  "draft_with_insurer",
  "pending_informal_action",
] as const satisfies readonly ComplaintStatus[];

export const OUTCOMES = ["upheld", "partially_upheld", "not_upheld"] as const;
export type Outcome = (typeof OUTCOMES)[number];
export const OUTCOME_LABELS: Record<Outcome, string> = {
  upheld: "Upheld",
  partially_upheld: "Partially upheld",
  not_upheld: "Not upheld",
};

export const PARTIES = ["insurer", "firm"] as const;
export type Party = (typeof PARTIES)[number];

export const ELIGIBILITY = ["eligible", "non_eligible"] as const;
export type Eligibility = (typeof ELIGIBILITY)[number];
export const ELIGIBILITY_LABELS: Record<Eligibility, string> = {
  eligible: "Eligible",
  non_eligible: "Non eligible",
};

export const RESOLUTION_PATHS = ["summary_resolution", "final_response"] as const;
export const RESOLUTION_PATH_LABELS = {
  summary_resolution: "Summary resolution",
  final_response: "Final / stage one issued",
} as const;

export const NOTIFICATION_TYPES = ["acknowledgement", "holding", "summary_resolution", "final_response"] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];
export const NOTIFICATION_CHANNELS = ["email", "letter"] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];
export const NOTIFICATION_STATUSES = ["draft", "sent", "failed"] as const;
export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number];

/** Reference tables a Manager maintains. */
export const REFERENCE_TABLES = [
  "ref_product",
  "ref_channel",
  "ref_complainant_type",
  "ref_nature_of_complaint",
  "ref_root_cause",
  "ref_secondary_cause",
  "ref_vulnerability_category",
] as const;
export type ReferenceTable = (typeof REFERENCE_TABLES)[number];

/** Fields a handler may edit after registration; mirrors app.editable_complaint_fields(). */
export const EDITABLE_FIELDS = [
  "handler_id",
  "complainant_type",
  "complainant_name",
  "complainant_email",
  "complainant_phone",
  "address_line1",
  "address_line2",
  "town",
  "county",
  "postcode",
  "country",
  "coverholder_id",
  "product",
  "channel",
  "claim_related",
  "claim_reference",
  "insurer_complaint_reference",
  "eligibility",
  "nature_of_complaint",
  "root_cause",
  "secondary_cause",
  "received_into_complaints_date",
  "summary",
  "findings",
  "vulnerable_customer",
  "vulnerability_category",
] as const;
export type EditableField = (typeof EDITABLE_FIELDS)[number];
