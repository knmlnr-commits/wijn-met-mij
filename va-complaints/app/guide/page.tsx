import type { Metadata } from "next";
import Link from "next/link";
import { ProcessFlow } from "@/components/ProcessFlow";
import { requirePageUser } from "@/lib/auth/session";
import { PROCESS, SCREEN_HELP } from "@/lib/help";
import { FCA_DEFAULTS } from "@/lib/rules";
import styles from "./guide.module.css";

export const metadata: Metadata = { title: "How it works | Van Ameyde Complaints Management" };

const SCREEN_LINKS: Record<string, string | null> = {
  dashboard: "/",
  register: "/register",
  complaint: null,
  reports: "/reports",
  settings: "/settings",
  framework: "/framework",
  changelog: "/changelog",
};

/** The application explained in one page: the process, the colours, the roles and every screen. */
export default async function GuidePage() {
  const user = await requirePageUser();
  const screens = SCREEN_HELP.filter((s) => s.key !== "settings" || user.role === "manager").filter((s) => s.key !== "register" || user.role !== "compliance");

  return (
    <div className="stack">
      <div className="page-header">
        <h1>How it works</h1>
      </div>
      <p className={styles.lead}>
        Complaints Management makes sure every insurance complaint is answered within the time the FCA allows. It keeps the clock for each
        complaint, tells you the next step, prepares the letters and records everything that happens.
      </p>

      <section className="stack">
        <h2>The process at a glance</h2>
        <ProcessFlow />
      </section>

      <section className="card stack">
        <h2>The life of a complaint, step by step</h2>
        <ol className={styles.process}>
          {PROCESS.map((p, i) => (
            <li key={p.title}>
              <span className={styles.number}>{i + 1}</span>
              <div>
                <strong>{p.title}</strong> <span className="badge">{p.who}</span>
                <p>{p.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <div className="grid-2">
        <section className="card stack">
          <h2>The deadlines</h2>
          <p className="small muted">The FCA defaults; an insurer can have its own, stricter values (see Framework).</p>
          <dl className="meta">
            <dt>Acknowledgement</dt>
            <dd>within {FCA_DEFAULTS.ackBusinessDays} business days</dd>
            <dt>Summary resolution</dt>
            <dd>possible for {FCA_DEFAULTS.summaryBusinessDays} business days</dd>
            <dt>Holding response prompt</dt>
            <dd>after {FCA_DEFAULTS.interimDays} days (week 4)</dd>
            <dt>Final response</dt>
            <dd>
              <strong>within {FCA_DEFAULTS.finalResponseDays} days (8 weeks)</strong>
            </dd>
            <dt>Referral to the FOS</dt>
            <dd>up to {FCA_DEFAULTS.fosReferralDays} days after the final response</dd>
            <dt>Records kept</dt>
            <dd>at least {FCA_DEFAULTS.retentionYears} years</dd>
          </dl>
          <p className="small muted">Business days skip weekends and England and Wales bank holidays.</p>
        </section>

        <section className="card stack">
          <h2>The colours</h2>
          <dl className="meta">
            <dt>
              <span className="rag rag-red">Red</span>
            </dt>
            <dd>A deadline was missed: the acknowledgement is overdue, the final response deadline has passed, or the final response went out late.</dd>
            <dt>
              <span className="rag rag-amber">Amber</span>
            </dt>
            <dd>Act soon: the final response deadline is within {FCA_DEFAULTS.amberWindowDays} days, or the acknowledgement has not been sent yet.</dd>
            <dt>
              <span className="rag rag-green">Green</span>
            </dt>
            <dd>On track, or answered in time.</dd>
          </dl>
          <h2>The roles</h2>
          <dl className="meta">
            <dt>Handler</dt>
            <dd>Registers and works complaints, sends the letters.</dd>
            <dt>Manager</dt>
            <dd>Everything a handler can do, plus settings, users and deleting complaints.</dd>
            <dt>Compliance</dt>
            <dd>Sees everything, changes nothing.</dd>
          </dl>
        </section>
      </div>

      <section className="stack">
        <h2>The screens</h2>
        {screens.map((s) => (
          <details key={s.key} className="card">
            <summary className="fold">{s.title}</summary>
            <p>{s.purpose}</p>
            {s.steps.length > 0 && (
              <ol>
                {s.steps.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ol>
            )}
            {s.tips.length > 0 && (
              <ul className="small muted">
                {s.tips.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            )}
            {SCREEN_LINKS[s.key] && (
              <p>
                <Link href={SCREEN_LINKS[s.key] as string}>Open {s.title}</Link>
              </p>
            )}
          </details>
        ))}
      </section>
    </div>
  );
}
