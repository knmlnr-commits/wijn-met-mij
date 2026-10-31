import { dayNumber, type IsoDate } from "./dates";
import type { Timeline } from "./timeline";

export type MilestoneKey = "received" | "acknowledgement" | "summary" | "interim" | "final";

export interface Milestone {
  key: MilestoneKey;
  label: string;
  date: IsoDate;
}

export interface ClockModel {
  /** Milestones in date order; displayed evenly spaced. */
  milestones: Milestone[];
  /** Position of today on the evenly spaced track, from 0 (received) to 1 (final deadline). */
  todayPosition: number;
  /** Index of the segment today falls in (between milestone i and i + 1); -1 before, length - 1 after. */
  todaySegment: number;
}

/**
 * Model for the regulatory clock. Milestones sit evenly spaced; today is interpolated by date
 * inside the segment it falls in. Order is by date, because a long acknowledgement target can
 * fall after the day 3 summary deadline.
 */
export function clockModel(t: Timeline): ClockModel {
  const order: MilestoneKey[] = ["received", "acknowledgement", "summary", "interim", "final"];
  const unordered: Milestone[] = [
    { key: "received", label: "Received", date: t.receivedDate },
    { key: "acknowledgement", label: "Acknowledgement", date: t.acknowledgementDue },
    { key: "summary", label: `Day ${t.profile.summaryBusinessDays} summary`, date: t.summaryDeadline },
    { key: "interim", label: `Week ${Math.round(t.profile.interimDays / 7)} interim`, date: t.interimDate },
    { key: "final", label: "Final response deadline", date: t.finalResponseDeadline },
  ];
  const milestones = unordered.sort(
    (a, b) => dayNumber(a.date) - dayNumber(b.date) || order.indexOf(a.key) - order.indexOf(b.key),
  );

  const today = dayNumber(t.today);
  const segments = milestones.length - 1;
  const first = dayNumber(milestones[0].date);
  const last = dayNumber(milestones[segments].date);

  if (today <= first) return { milestones, todayPosition: 0, todaySegment: today < first ? -1 : 0 };
  if (today >= last) return { milestones, todayPosition: 1, todaySegment: segments };

  let segment = 0;
  while (segment < segments - 1 && today >= dayNumber(milestones[segment + 1].date)) segment++;
  const start = dayNumber(milestones[segment].date);
  const end = dayNumber(milestones[segment + 1].date);
  const within = end === start ? 0 : (today - start) / (end - start);
  return { milestones, todayPosition: (segment + within) / segments, todaySegment: segment };
}
