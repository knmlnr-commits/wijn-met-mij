/**
 * Row shapes returned by the repository layer. They mirror supabase/migrations; dates are ISO
 * `yyyy-mm-dd` strings, timestamps ISO strings in UTC, money as numbers in GBP.
 */
import type {
  ComplaintStatus,
  Eligibility,
  NotificationChannel,
  NotificationStatus,
  NotificationType,
  Outcome,
  Party,
  Role,
} from "@/lib/domain/complaint";
import type { IsoDate, ResolutionPath } from "@/lib/rules";

export interface SlaColumns {
  ack_business_days: number | null;
  summary_business_days: number | null;
  interim_days: number | null;
  final_response_days: number | null;
  fos_referral_days: number | null;
  amber_window_days: number | null;
  retention_years: number | null;
}

export interface ProfileRow {
  id: string;
  display_name: string;
  email: string;
  role: Role;
  is_active: boolean;
}

export interface FirmSettingsRow extends SlaColumns {
  firm_name: string;
  firm_short_name: string;
  bank_holidays_enabled: boolean;
  fos_wording: string | null;
  lloyds_wording: string | null;
  fos_contact: string | null;
  updated_at: string;
}

export interface InsurerRow extends SlaColumns {
  id: string;
  name: string;
  is_active: boolean;
  is_lloyds: boolean;
}

export interface CoverholderRow {
  id: string;
  name: string;
  is_active: boolean;
}

export interface ReferenceRow {
  code: string;
  label: string;
  sort_order: number;
  is_active: boolean;
}

export interface BankHolidayRow {
  date: IsoDate;
  name: string;
  region: string;
}

export interface ComplaintRow {
  id: string;
  reference: string;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  handler_id: string | null;
  complainant_type: string | null;
  complainant_name: string;
  complainant_email: string | null;
  complainant_phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  town: string | null;
  county: string | null;
  postcode: string | null;
  country: string | null;
  insurer_id: string;
  coverholder_id: string | null;
  product: string | null;
  channel: string | null;
  claim_related: boolean | null;
  claim_reference: string | null;
  insurer_complaint_reference: string | null;
  eligibility: Eligibility | null;
  nature_of_complaint: string | null;
  root_cause: string | null;
  secondary_cause: string | null;
  received_date: IsoDate;
  received_into_complaints_date: IsoDate | null;
  acknowledged_date: IsoDate | null;
  holding_response_date: IsoDate | null;
  final_response_date: IsoDate | null;
  fos_referred_date: IsoDate | null;
  lloyds_referred_date: IsoDate | null;
  fos_closed_date: IsoDate | null;
  lloyds_closed_date: IsoDate | null;
  closed_date: IsoDate | null;
  summary: string;
  findings: string | null;
  status: ComplaintStatus;
  resolution_path: ResolutionPath | null;
  outcome: Outcome | null;
  upheld_against: Party | null;
  compensation_amount: number | null;
  compensation_paid_by: Party | null;
  fos_lloyds_reference: string | null;
  lloyds_outcome: string | null;
  fos_decision: string | null;
  ombudsman_decision: string | null;
  compensation_awarded_after_fos: number | null;
  compensation_awarded_after_lloyds: number | null;
  vulnerable_customer: boolean;
  vulnerability_category: string | null;
  is_deleted: boolean;
  deleted_at: string | null;
  deleted_by: string | null;
  deletion_reason: string | null;
}

export interface ComplaintEventRow {
  id: string;
  complaint_id: string;
  occurred_at: string;
  actor_id: string | null;
  event_type: string;
  description: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}

export interface NotificationRow {
  id: string;
  complaint_id: string;
  type: NotificationType;
  channel: NotificationChannel;
  rendered_content: string;
  recipient_email: string | null;
  status: NotificationStatus;
  created_at: string;
  sent_at: string | null;
  created_by: string | null;
}
