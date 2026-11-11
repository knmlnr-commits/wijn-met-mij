/**
 * Synthetic demo complaints, generated relative to "today" so every RAG state and every status
 * is present whenever the seed runs. Synthetic data only: names, emails and references are
 * obviously fictitious (example.test is a reserved domain).
 */
import type { ComplaintStatus, Outcome, Party } from "@/lib/domain/complaint";
import { addDays, type IsoDate } from "@/lib/rules";

export type DemoInsurer = "Lloyd's" | "Allianz" | "AXA" | "Aviva" | "Zurich";

interface Spec {
  insurer: DemoInsurer;
  status: ComplaintStatus;
  /** Days before today the complaint was received. */
  ago: number;
  /** Lifecycle offsets in days after receipt. */
  ack?: number;
  holding?: number;
  summary?: true;
  final?: { after: number; outcome: Outcome; against?: Party; amount?: number; paidBy?: Party };
  lloyds?: { after: number; outcome?: { after: number; decision: string; amount?: number } };
  fos?: { after: number; outcome?: { after: number; decision: string; ombudsman?: string; amount?: number } };
  closed?: number;
  actionsRequired?: true;
  manager?: true;
}

const SPECS: Spec[] = [
  { insurer: "Zurich", status: "new", ago: 0 },
  { insurer: "Allianz", status: "new", ago: 10 },
  { insurer: "Aviva", status: "pending_informal_action", ago: 1 },
  { insurer: "Zurich", status: "acknowledged", ago: 5, ack: 1 },
  { insurer: "Lloyd's", status: "investigating", ago: 20, ack: 1 },
  { insurer: "AXA", status: "awaiting_information", ago: 30, ack: 2 },
  { insurer: "Allianz", status: "referred_to_insurer", ago: 30, ack: 1 },
  { insurer: "Zurich", status: "draft_with_insurer", ago: 50, ack: 1, holding: 28 },
  { insurer: "Aviva", status: "investigating", ago: 35, ack: 1, manager: true },
  { insurer: "Zurich", status: "awaiting_information", ago: 70, ack: 1, holding: 28 },
  { insurer: "Lloyd's", status: "resolved", ago: 2, summary: true },
  { insurer: "Zurich", status: "resolved", ago: 40, ack: 1, final: { after: 35, outcome: "not_upheld" } },
  {
    insurer: "AXA",
    status: "compensation_outstanding",
    ago: 45,
    ack: 2,
    final: { after: 40, outcome: "upheld", against: "insurer", amount: 250, paidBy: "insurer" },
  },
  {
    insurer: "Allianz",
    status: "compensation_paid",
    ago: 60,
    ack: 1,
    final: { after: 38, outcome: "partially_upheld", against: "firm", amount: 120.5, paidBy: "firm" },
  },
  {
    insurer: "Lloyd's",
    status: "referred_to_lloyds",
    ago: 100,
    ack: 1,
    holding: 28,
    final: { after: 50, outcome: "not_upheld" },
    lloyds: { after: 70 },
  },
  {
    insurer: "Zurich",
    status: "referred_to_fos",
    ago: 120,
    ack: 1,
    holding: 28,
    final: { after: 60, outcome: "not_upheld" },
    fos: { after: 80 },
  },
  {
    insurer: "Lloyd's",
    status: "actions_required_following_decision",
    ago: 200,
    ack: 1,
    final: { after: 45, outcome: "not_upheld" },
    lloyds: { after: 60, outcome: { after: 150, decision: "Upheld", amount: 300 } },
    actionsRequired: true,
  },
  {
    insurer: "Aviva",
    status: "actions_required_following_decision",
    ago: 180,
    ack: 1,
    final: { after: 20, outcome: "not_upheld" },
    fos: { after: 40, outcome: { after: 150, decision: "Upheld", amount: 500 } },
    actionsRequired: true,
    manager: true,
  },
  { insurer: "Zurich", status: "closed", ago: 90, ack: 1, final: { after: 30, outcome: "not_upheld" }, closed: 31 },
  { insurer: "AXA", status: "closed", ago: 15, summary: true, closed: 2 },
  { insurer: "Lloyd's", status: "acknowledged", ago: 3, ack: 1 },
  { insurer: "Zurich", status: "investigating", ago: 44, ack: 1 },
  // Acknowledged after its target whatever the weekday or bank holiday: the late acknowledgement example.
  { insurer: "Allianz", status: "investigating", ago: 15, ack: 6 },
  { insurer: "AXA", status: "pending_informal_action", ago: 4, ack: 1 },
  {
    insurer: "Lloyd's",
    status: "closed",
    ago: 400,
    ack: 1,
    final: { after: 40, outcome: "upheld", against: "firm", amount: 75, paidBy: "firm" },
    closed: 60,
    manager: true,
  },
];

/**
 * Demo reference values so the breakdowns have content. TODO(CONFIRM): placeholders for the
 * sandbox only; the real lists come from spec section 3 and Complaint_Field_Requirements.xlsx
 * (docs/OPEN_ITEMS.md). Loaded by the demo seed, never by supabase/seed.sql.
 */
export const DEMO_REFERENCE = {
  ref_product: ["Motor", "Household / Property", "Travel", "Marine", "Commercial Property", "Liability", "Pet", "Other"],
  ref_channel: ["Phone", "Email", "Letter", "In person", "Internal referral", "Insurer referral"],
  ref_nature_of_complaint: ["Claims handling decision", "Delays / timescales", "Other general admin/customer service", "Errors / not following instructions", "Terms and disputed sums / charges"],
  ref_root_cause: ["Claim - quantum", "Claim - delay", "Claim - declinature", "Communication", "Service provider"],
  ref_secondary_cause: ["Process", "People", "Systems", "Third party"],
  ref_vulnerability_category: ["Health", "Life events", "Resilience", "Capability"],
} as const;

export type DemoReferenceTable = keyof typeof DEMO_REFERENCE;

/** Reference code for a demo label: upper case, non letters and digits to underscores. */
export function demoCode(label: string): string {
  return label.toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "");
}

export function demoReferenceRows(table: DemoReferenceTable) {
  return DEMO_REFERENCE[table].map((label, i) => ({ code: demoCode(label), label, sort_order: (i + 1) * 10, is_active: true }));
}

const pick = (table: DemoReferenceTable, i: number) => demoCode(DEMO_REFERENCE[table][i % DEMO_REFERENCE[table].length]);

/**
 * Uneven spread, so the breakdowns look like real MI and not a round robin. Each list of
 * weights adds up to 25 (one slot per demo complaint); the stride walks the slots in a fixed
 * scrambled order, so the result is the same on every run.
 */
function spread(table: DemoReferenceTable, weights: number[], stride: number, i: number): string {
  const slots = weights.flatMap((w, index) => Array<number>(w).fill(index));
  return demoCode(DEMO_REFERENCE[table][slots[(i * stride) % slots.length]]);
}

/**
 * Demo letter wording and FOS contact details, so letters can be sent in the sandbox.
 * TODO(CONFIRM): placeholders; the wording to use comes verbatim from spec section 4
 * (docs/OPEN_ITEMS.md). Loaded by the demo seed only, and only where the setting is empty.
 */
export const DEMO_FIRM_WORDING = {
  fos_wording:
    "You have the right to refer your complaint to the Financial Ombudsman Service, free of charge. You must do so within six months of the date of this letter. If you do not refer your complaint in time, the Ombudsman will not have our permission to consider it and will only be able to do so in very limited circumstances.",
  lloyds_wording:
    "If you remain dissatisfied, you may refer your complaint to the Complaints team at Lloyd's, who will investigate the matter and provide a final response. Lloyd's Complaints, One Lime Street, London EC3M 7HA; email complaints@lloyds.com; telephone +44 (0)20 7327 5693. Details of the Lloyd's complaints procedure are available at www.lloyds.com/complaints.",
  fos_contact: "Financial Ombudsman Service, Exchange Tower, London E14 9SR; telephone 0800 023 4567; website www.financial-ombudsman.org.uk.",
} as const;
/** Demo complaints (1 based) with a vulnerable customer. */
const VULNERABLE = new Set([5, 9, 13]);

const COMPLAINANT_TYPES = ["PH", "BROKER", "CLAIMANT", "SOLICITOR", "TENANT"];
const TOPICS = [
  "delay in settling a claim",
  "level of the settlement offer",
  "communication during the claim",
  "decision to decline part of a claim",
  "service received from a contractor",
];

export interface DemoEvent {
  event_type: string;
  description: string;
  occurred_on: IsoDate;
  after: Record<string, unknown> | null;
}

export interface DemoComplaint {
  insurer: DemoInsurer;
  assignTo: "handler" | "manager";
  row: {
    complainant_type: string;
    complainant_name: string;
    complainant_email: string;
    complainant_phone: string | null;
    product: string;
    channel: string;
    nature_of_complaint: string;
    root_cause: string;
    secondary_cause: string;
    vulnerable_customer: boolean;
    vulnerability_category: string | null;
    town: string;
    country: string;
    claim_related: boolean;
    claim_reference: string;
    eligibility: "eligible" | "non_eligible";
    received_date: IsoDate;
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
    resolution_path: "summary_resolution" | "final_response" | null;
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
  };
  events: DemoEvent[];
}

export const DEMO_COUNT = SPECS.length;

export function generateDemoComplaints(today: IsoDate): DemoComplaint[] {
  return SPECS.map((s, i) => {
    const n = String(i + 1).padStart(2, "0");
    const received = addDays(today, -s.ago);
    const on = (after: number | undefined) => (after === undefined ? null : addDays(received, after));
    const topic = TOPICS[i % TOPICS.length];
    const events: DemoEvent[] = [{ event_type: "registered", description: "Complaint registered", occurred_on: received, after: null }];
    const log = (event_type: string, description: string, date: IsoDate | null, after: Record<string, unknown> | null = null) => {
      if (date) events.push({ event_type, description, occurred_on: date, after });
    };

    const acknowledged = on(s.ack);
    const holding = on(s.holding);
    const finalDate = on(s.final?.after);
    const lloydsReferred = on(s.lloyds?.after);
    const lloydsClosed = on(s.lloyds?.outcome?.after);
    const fosReferred = on(s.fos?.after);
    const fosClosed = on(s.fos?.outcome?.after);
    const closed = on(s.closed);
    const summaryDate = s.summary ? addDays(received, Math.min(1, s.ago)) : null;

    log("acknowledged", "Acknowledgement sent", acknowledged, { acknowledged_date: acknowledged });
    log("holding_response_sent", "Holding response sent", holding, { holding_response_date: holding });
    log("summary_resolved", "Resolved by summary resolution", summaryDate, { status: "resolved", resolution_path: "summary_resolution" });
    log("final_response_sent", "Final response sent", finalDate, { final_response_date: finalDate, outcome: s.final?.outcome ?? null });
    log("referred_to_lloyds", "Referred to Lloyd's", lloydsReferred, { lloyds_referred_date: lloydsReferred });
    log("lloyds_outcome_recorded", "Lloyd's outcome recorded", lloydsClosed, { lloyds_outcome: s.lloyds?.outcome?.decision ?? null });
    log("referred_to_fos", "Referred to the FOS", fosReferred, { fos_referred_date: fosReferred });
    log("fos_outcome_recorded", "FOS outcome recorded", fosClosed, { fos_decision: s.fos?.outcome?.decision ?? null });
    log("closed", "Complaint closed", closed, { status: "closed", closed_date: closed });

    return {
      insurer: s.insurer,
      assignTo: s.manager ? "manager" : "handler",
      row: {
        complainant_type: COMPLAINANT_TYPES[i % COMPLAINANT_TYPES.length],
        complainant_name: `Demo Complainant ${n}`,
        complainant_email: `demo${n}@example.test`,
        // 01632 is the range Ofcom reserves for drama and examples.
        complainant_phone: i % 3 === 0 ? `01632 9600${n}` : null,
        product: spread("ref_product", [7, 6, 3, 1, 3, 2, 2, 1], 7, i),
        channel: spread("ref_channel", [8, 9, 4, 1, 1, 2], 9, i),
        nature_of_complaint: spread("ref_nature_of_complaint", [8, 7, 5, 3, 2], 11, i),
        root_cause: spread("ref_root_cause", [6, 9, 5, 3, 2], 13, i),
        secondary_cause: spread("ref_secondary_cause", [10, 7, 5, 3], 3, i),
        vulnerable_customer: VULNERABLE.has(i + 1),
        vulnerability_category: VULNERABLE.has(i + 1) ? pick("ref_vulnerability_category", i / 4) : null,
        town: "Testtown",
        country: "United Kingdom",
        claim_related: i % 4 !== 3,
        claim_reference: `DEMO-CLM-${n}`,
        eligibility: i % 7 === 6 ? "non_eligible" : "eligible",
        received_date: received,
        acknowledged_date: acknowledged,
        holding_response_date: holding,
        final_response_date: finalDate,
        fos_referred_date: fosReferred,
        lloyds_referred_date: lloydsReferred,
        fos_closed_date: fosClosed,
        lloyds_closed_date: lloydsClosed,
        closed_date: closed,
        summary: `Synthetic demo complaint ${n} about the ${topic}.`,
        findings: s.final || s.summary ? `Synthetic findings for demo complaint ${n}.` : null,
        status: s.status,
        resolution_path: s.summary ? "summary_resolution" : s.final ? "final_response" : null,
        outcome: s.final?.outcome ?? null,
        upheld_against: s.final?.against ?? null,
        compensation_amount: s.final?.amount ?? null,
        compensation_paid_by: s.final?.paidBy ?? null,
        fos_lloyds_reference: fosReferred ? `FOS-DEMO-${n}` : lloydsReferred ? `LLOYDS-DEMO-${n}` : null,
        lloyds_outcome: s.lloyds?.outcome?.decision ?? null,
        fos_decision: s.fos?.outcome?.decision ?? null,
        ombudsman_decision: s.fos?.outcome?.ombudsman ?? null,
        compensation_awarded_after_fos: s.fos?.outcome?.amount ?? null,
        compensation_awarded_after_lloyds: s.lloyds?.outcome?.amount ?? null,
      },
      events,
    };
  });
}
