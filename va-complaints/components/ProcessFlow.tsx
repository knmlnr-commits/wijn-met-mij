import { FCA_DEFAULTS } from "@/lib/rules";
import styles from "./ProcessFlow.module.css";

interface Step {
  n: number;
  title: string;
  when: string;
  text: string;
  /** A side route that leaves the main path at this step. */
  branch?: { title: string; text: string };
}

const weeks = Math.round(FCA_DEFAULTS.finalResponseDays / 7);

const STEPS: Step[] = [
  { n: 1, title: "Register", when: "Day 0", text: "Complaint type, received date, name and summary. The clock starts." },
  {
    n: 2,
    title: "Acknowledge",
    when: `Within ${FCA_DEFAULTS.ackBusinessDays} business days`,
    text: "Acknowledgement letter to the complainant.",
    branch: { title: "Summary resolution", text: `Settled within ${FCA_DEFAULTS.summaryBusinessDays} business days: confirm in writing, no final response needed.` },
  },
  {
    n: 3,
    title: "Investigate",
    when: `Up to ${weeks} weeks`,
    text: "Status follows the work: investigating, awaiting information, with the insurer.",
    branch: { title: "Holding response", text: `Prompt at week ${Math.round(FCA_DEFAULTS.interimDays / 7)}. At the deadline it must give the right to go to the FOS.` },
  },
  {
    n: 4,
    title: "Final response",
    when: `By day ${FCA_DEFAULTS.finalResponseDays}`,
    text: "Outcome, upheld against, compensation and findings, with the referral rights.",
    branch: { title: "Referral", text: `Lloyd's or the FOS, up to ${FCA_DEFAULTS.fosReferralDays} days later: record the referral, then the decision and any award.` },
  },
  { n: 5, title: "Close", when: "When all is done", text: `Compensation paid, complaint closed. Records kept at least ${FCA_DEFAULTS.retentionYears} years.` },
];

/**
 * The process at a glance: numbered points on one line, side routes underneath. Deadlines come
 * from the rules engine defaults. Stacks vertically on phones.
 */
export function ProcessFlow() {
  return (
    <figure className={styles.figure} aria-label="Process flow of a complaint">
      <ol className={styles.flow}>
        {STEPS.map((s) => (
          <li key={s.n} className={styles.col}>
            <div className={styles.node}>
              <span className={styles.number}>{s.n}</span>
            </div>
            <div className={styles.when}>{s.when}</div>
            <strong className={styles.title}>{s.title}</strong>
            <span className={styles.text}>{s.text}</span>
            {s.branch && (
              <div className={styles.branch}>
                <strong>{s.branch.title}</strong>
                <span>{s.branch.text}</span>
              </div>
            )}
          </li>
        ))}
      </ol>
      <figcaption className={styles.caption}>
        <span>
          <span className={`${styles.key} ${styles.keyMain}`} /> Main path
        </span>
        <span>
          <span className={`${styles.key} ${styles.keyBranch}`} /> Side route, only when it applies
        </span>
        <span>Throughout: the regulatory clock, RAG status, next step and audit trail follow every complaint.</span>
      </figcaption>
    </figure>
  );
}
