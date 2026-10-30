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
  { insurer: "Allianz", status: "investigating", ago: 15, ack: 3 },
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
