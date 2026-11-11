import { timelineForComplaint } from "@/lib/db/profile";
import type { BankHolidayRow, ComplaintRow, FirmSettingsRow, InsurerRow, ProfileRow } from "@/lib/db/types";
import type { ComplaintStatus } from "@/lib/domain/complaint";
import { type IsoDate, type Rag, riskSortKey, type Timeline } from "@/lib/rules";

/** A complaint with its regulatory clock and display names, as the screens use it. */
export interface ComplaintView {
  complaint: ComplaintRow;
  timeline: Timeline;
  insurer: InsurerRow | null;
  insurerName: string;
  handlerName: string;
}

export interface ViewContext {
  firm: FirmSettingsRow | null;
  insurers: InsurerRow[];
  holidays: BankHolidayRow[];
  profiles: ProfileRow[];
}

export function buildView(complaint: ComplaintRow, ctx: ViewContext, today: IsoDate): ComplaintView {
  const insurer = ctx.insurers.find((i) => i.id === complaint.insurer_id) ?? null;
  const handler = ctx.profiles.find((p) => p.id === complaint.handler_id);
  return {
    complaint,
    timeline: timelineForComplaint(complaint, insurer, ctx.firm, ctx.holidays, today),
    insurer,
    insurerName: insurer?.name ?? "Unknown",
    handlerName: handler?.display_name ?? "Unassigned",
  };
}

/** Most at risk first: red, amber, green; then nearest deadline; then oldest. */
export function sortByRisk(views: ComplaintView[]): ComplaintView[] {
  return [...views].sort((a, b) => {
    const [ra, da] = riskSortKey(a.timeline);
    const [rb, db] = riskSortKey(b.timeline);
    if (ra !== rb) return ra - rb;
    if (da !== db) return da === Infinity ? 1 : db === Infinity ? -1 : da - db;
    return a.complaint.received_date.localeCompare(b.complaint.received_date);
  });
}

export interface DashboardFilters {
  search?: string;
  status?: ComplaintStatus;
  insurerId?: string;
  handlerId?: string;
  rag?: Rag;
  product?: string;
  vulnerable?: boolean;
}

export function filterViews(views: ComplaintView[], f: DashboardFilters): ComplaintView[] {
  const term = f.search?.trim().toLowerCase();
  return views.filter(({ complaint: c, timeline: t }) => {
    if (f.status && c.status !== f.status) return false;
    if (f.insurerId && c.insurer_id !== f.insurerId) return false;
    if (f.handlerId && c.handler_id !== f.handlerId) return false;
    if (f.rag && t.rag !== f.rag) return false;
    if (f.product && c.product !== f.product) return false;
    if (f.vulnerable !== undefined && c.vulnerable_customer !== f.vulnerable) return false;
    if (term) {
      const haystack = [c.reference, c.complainant_name, c.claim_reference, c.insurer_complaint_reference]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(term)) return false;
    }
    return true;
  });
}

export function isOpen(c: Pick<ComplaintRow, "resolution_path" | "closed_date">): boolean {
  return c.resolution_path === null && c.closed_date === null;
}

export interface Kpis {
  open: number;
  breaching: number;
  dueWithin7Days: number;
  resolvedOrClosed: number;
  compensationOutstanding: number;
}

export function kpis(views: ComplaintView[]): Kpis {
  return {
    open: views.filter((v) => isOpen(v.complaint)).length,
    breaching: views.filter((v) => v.timeline.rag === "red" && v.complaint.status !== "closed").length,
    dueWithin7Days: views.filter((v) => isOpen(v.complaint) && v.timeline.daysToDeadline >= 0 && v.timeline.daysToDeadline <= 7).length,
    resolvedOrClosed: views.filter((v) => !isOpen(v.complaint)).length,
    compensationOutstanding: views.filter((v) => v.complaint.status === "compensation_outstanding").length,
  };
}

/** Why a complaint has its RAG colour, in a few words; shown under the chip so red never looks like a bug. */
export function ragReason(t: Timeline): string {
  if (t.finalResponseLate) return "Final response sent late";
  if (t.acknowledgementLate && !t.finalResponseOverdue) return "Acknowledgement sent late";
  if (t.acknowledgementOverdue) return "Acknowledgement overdue";
  if (t.finalResponseOverdue) return "Final response overdue";
  if (t.summaryResolved) return "Summary resolved";
  if (t.finalResponseSent) return "Answered in time";
  if (t.rag === "amber") return t.awaitingAcknowledgement && t.daysToDeadline > t.profile.amberWindowDays ? "Acknowledgement due" : "Deadline close";
  return "On track";
}

/** Work that still needs someone, beyond the regulatory RAG: unpaid compensation and actions after a decision. */
export function hasOutstandingWork(c: Pick<ComplaintRow, "status">): boolean {
  return c.status === "compensation_outstanding" || c.status === "actions_required_following_decision";
}
