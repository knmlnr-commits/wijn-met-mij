import type { Breakdown } from "@/lib/reports/mi";
import styles from "../reports.module.css";

export type Tone = "navy" | "navyLight" | "turquoise" | "rose" | "muted";

/** One bar split to 100%. Every part is named in the legend with its count and share, so colour is never the only cue. */
export function StackedBar({ rows, tones, label }: { rows: Breakdown[]; tones: Record<string, Tone>; label: string }) {
  if (rows.length === 0) return <p className="muted">No complaints for this selection</p>;
  const tone = (name: string) => styles[`tone_${tones[name] ?? "muted"}`];
  const summary = rows.map((r) => `${r.label} ${r.count} (${r.percent.toFixed(1)}%)`).join(", ");
  return (
    <div>
      <div className={styles.stack} role="img" aria-label={`${label}: ${summary}`}>
        {rows.map((r) => (
          <span
            key={r.label}
            className={`${styles.stackPart} ${tone(r.label)}`}
            style={{ flexGrow: r.count }}
            title={`${r.label}: ${r.count}, ${r.percent.toFixed(1)}%`}
          />
        ))}
      </div>
      <ul className={styles.legend}>
        {rows.map((r) => (
          <li key={r.label}>
            <span className={`${styles.swatch} ${tone(r.label)}`} aria-hidden="true" />
            <span>{r.label}</span>
            <span className={styles.legendValue}>
              {r.count} <span className="muted">({r.percent.toFixed(1)}%)</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
