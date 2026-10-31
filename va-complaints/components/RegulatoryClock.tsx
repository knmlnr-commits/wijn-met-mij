import { formatDate } from "@/lib/format";
import { clockModel, isAfter, type Timeline } from "@/lib/rules";
import { Rag } from "./Rag";
import styles from "./RegulatoryClock.module.css";

function deadlineText(t: Timeline): string {
  if (t.summaryResolved) return "Resolved by summary resolution";
  if (t.finalResponseSent) return t.finalResponseLate ? "Final response sent after the deadline" : "Final response sent within the deadline";
  if (t.daysToDeadline > 0) return `${t.daysToDeadline} ${t.daysToDeadline === 1 ? "day" : "days"} to the final response deadline`;
  if (t.daysToDeadline === 0) return "Final response deadline is today";
  const over = -t.daysToDeadline;
  return `Final response deadline passed ${over} ${over === 1 ? "day" : "days"} ago`;
}

/**
 * The regulatory clock: milestones evenly spaced, today interpolated into its segment.
 * Horizontal on wide screens, vertical on phones.
 */
export function RegulatoryClock({ timeline }: { timeline: Timeline }) {
  const model = clockModel(timeline);
  const percent = Math.round(model.todayPosition * 1000) / 10;
  const flags: string[] = [];
  if (timeline.acknowledgementOverdue) flags.push("Acknowledgement is overdue.");
  if (timeline.summaryEligible) flags.push(`Summary resolution is possible until ${formatDate(timeline.summaryDeadline)}.`);
  if (timeline.summaryRouteExpired) flags.push("The summary route has closed; this is now a formal complaint.");
  if (timeline.interimHoldingDue) flags.push("Week 4 reached without a holding response (prompt, not a breach).");
  if (timeline.holdingRequiresFosRights) flags.push("Deadline reached: a holding response must explain the delay and give FOS referral rights.");
  if (timeline.fosWindowEnd) flags.push(`FOS referral window ends ${formatDate(timeline.fosWindowEnd)}.`);

  return (
    <section className={styles.clock} aria-label="Regulatory clock">
      <div className={styles.head}>
        <h2>Regulatory clock</h2>
        <Rag value={timeline.rag} />
      </div>
      <div className={styles.track} style={{ ["--today" as string]: `${percent}%` }}>
        <div className={styles.line} aria-hidden="true">
          <div className={styles.progress} />
        </div>
        <ol className={styles.milestones}>
          {model.milestones.map((m) => {
            const passed = !isAfter(m.date, timeline.today);
            return (
              <li key={m.key} className={passed ? styles.passed : undefined}>
                <span className={styles.dot} aria-hidden="true" />
                <span className={styles.label}>{m.label}</span>
                <span className={styles.date}>{formatDate(m.date)}</span>
              </li>
            );
          })}
        </ol>
        <span className={styles.today} aria-hidden="true">
          Today
        </span>
      </div>
      <p className={styles.legend}>
        <strong>{deadlineText(timeline)}</strong>
        <span className="muted"> · Today {formatDate(timeline.today)}</span>
      </p>
      {flags.length > 0 && (
        <ul className={styles.flags}>
          {flags.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
