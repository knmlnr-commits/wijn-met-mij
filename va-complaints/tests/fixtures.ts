/** Synthetic rows for tests of the screens' logic. */
import { buildView, type ComplaintView, type ViewContext } from "@/lib/complaints/view";
import type { ComplaintRow, FirmSettingsRow, InsurerRow, SlaColumns } from "@/lib/db/types";
import { EW_2026 } from "@/lib/rules/test-fixtures";
import { generateDemoComplaints } from "@/scripts/lib/demo-data";

const NO_SLA: SlaColumns = {
  ack_business_days: null,
  summary_business_days: null,
  interim_days: null,
  final_response_days: null,
  fos_referral_days: null,
  amber_window_days: null,
  retention_years: null,
};

export const FIRM: FirmSettingsRow = {
  ...NO_SLA,
  firm_name: "Van Ameyde",
  firm_short_name: "Van Ameyde",
  bank_holidays_enabled: true,
  fos_wording: null,
  lloyds_wording: null,
  fos_contact: null,
  updated_at: "2026-10-30T00:00:00Z",
};

const insurer = (name: string, is_lloyds: boolean, sla: Partial<SlaColumns>): InsurerRow => ({
  ...NO_SLA,
  ...sla,
  id: `ins-${name}`,
  name,
  is_active: true,
  is_lloyds,
});

export const INSURERS: InsurerRow[] = [
  insurer("Lloyd's", true, { ack_business_days: 1, final_response_days: 56, retention_years: 3 }),
  insurer("Allianz", false, { ack_business_days: 1, final_response_days: 40, retention_years: 3 }),
  insurer("AXA", false, { ack_business_days: 2, final_response_days: 56, retention_years: 6 }),
  insurer("Aviva", false, { ack_business_days: 1, final_response_days: 28, retention_years: 3 }),
  insurer("Zurich", false, { ack_business_days: 1, final_response_days: 56, retention_years: 3 }),
];

export const CONTEXT: ViewContext = {
  firm: FIRM,
  insurers: INSURERS,
  holidays: EW_2026,
  profiles: [
    { id: "p-handler", display_name: "Demo Handler", email: "handler@example.test", role: "handler", is_active: true },
    { id: "p-manager", display_name: "Demo Manager", email: "manager@example.test", role: "manager", is_active: true },
  ],
};

export function complaintRow(overrides: Partial<ComplaintRow> = {}): ComplaintRow {
  return {
    id: "c-1",
    reference: "C-000001",
    created_at: "2026-10-01T09:00:00Z",
    updated_at: "2026-10-01T09:00:00Z",
    created_by: "p-handler",
    handler_id: "p-handler",
    complainant_type: null,
    complainant_name: "Demo Complainant",
    complainant_email: null,
    complainant_phone: null,
    address_line1: null,
    address_line2: null,
    town: null,
    county: null,
    postcode: null,
    country: null,
    insurer_id: "ins-Zurich",
    coverholder_id: null,
    product: null,
    channel: null,
    claim_related: null,
    claim_reference: null,
    insurer_complaint_reference: null,
    eligibility: null,
    nature_of_complaint: null,
    root_cause: null,
    secondary_cause: null,
    received_date: "2026-10-01",
    received_into_complaints_date: null,
    acknowledged_date: null,
    holding_response_date: null,
    final_response_date: null,
    fos_referred_date: null,
    lloyds_referred_date: null,
    fos_closed_date: null,
    lloyds_closed_date: null,
    closed_date: null,
    summary: "Synthetic summary",
    findings: null,
    status: "new",
    resolution_path: null,
    outcome: null,
    upheld_against: null,
    compensation_amount: null,
    compensation_paid_by: null,
    fos_lloyds_reference: null,
    lloyds_outcome: null,
    fos_decision: null,
    ombudsman_decision: null,
    compensation_awarded_after_fos: null,
    compensation_awarded_after_lloyds: null,
    vulnerable_customer: false,
    vulnerability_category: null,
    is_deleted: false,
    deleted_at: null,
    deleted_by: null,
    deletion_reason: null,
    ...overrides,
  };
}

/** The 25 synthetic demo complaints as views, evaluated on `today`. */
export function demoViews(today: string): ComplaintView[] {
  return generateDemoComplaints(today).map((d, i) =>
    buildView(
      complaintRow({
        ...d.row,
        id: `c-${i + 1}`,
        reference: `C-${String(i + 1).padStart(6, "0")}`,
        insurer_id: `ins-${d.insurer}`,
        handler_id: d.assignTo === "manager" ? "p-manager" : "p-handler",
      }),
      CONTEXT,
      today,
    ),
  );
}
