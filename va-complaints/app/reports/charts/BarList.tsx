import Link from "next/link";
import { type Breakdown, NOT_RECORDED } from "@/lib/reports/mi";
import styles from "../reports.module.css";

/**
 * Horizontal bars, largest first, each with its count and share of the total. "Not recorded"
 * comes last in muted grey. With hrefFor, each row is a link (used to filter on an insurer).
 */
export function BarList({ rows, hrefFor, unit = "complaints" }: { rows: Breakdown[]; hrefFor?: (label: string) => string; unit?: string }) {
  if (rows.length === 0) return <p className="muted">No complaints for this selection</p>;
  const max = Math.max(...rows.map((r) => r.count));
  return (
    <ul className={styles.bars}>
      {rows.map((r) => {
        const muted = r.label === NOT_RECORDED;
        const title = `${r.label}: ${r.count} ${unit}, ${r.percent.toFixed(1)}% of the total`;
        const body = (
          <>
            <span className={styles.barLabel}>{r.label}</span>
            <span className={styles.barTrack} aria-hidden="true">
              <span className={muted ? styles.barFillMuted : styles.barFill} style={{ width: `${(100 * r.count) / max}%` }} />
            </span>
            <span className={styles.barValue}>
              {r.count} <span className="muted">({r.percent.toFixed(1)}%)</span>
            </span>
          </>
        );
        return (
          <li key={r.label} title={title}>
            {hrefFor && !muted ? (
              <Link className={styles.barRowLink} href={hrefFor(r.label)} aria-label={`${title}. Show only ${r.label}`}>
                {body}
              </Link>
            ) : (
              <div className={styles.barRow}>{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
