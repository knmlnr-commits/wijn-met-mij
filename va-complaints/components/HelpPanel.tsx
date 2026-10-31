"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import styles from "./HelpPanel.module.css";

const HELP: { match: (path: string) => boolean; title: string; points: string[] }[] = [
  {
    match: (p) => p === "/",
    title: "Dashboard",
    points: [
      "Every complaint shows its RAG status. Red means a regulatory breach or an overdue step; amber means a deadline is close or acknowledgement is still due.",
      "The list is sorted most at risk first. Use the filters to narrow it down; search covers reference, name and claim references.",
      "Select a reference to open the complaint and act on it.",
    ],
  },
  {
    match: (p) => p.startsWith("/register"),
    title: "Registering a complaint",
    points: [
      "Complaint type is the insurer; it sets the deadlines. The preview shows the timeline that will apply.",
      "The received date starts the regulatory clock. It cannot be in the future and cannot be changed later.",
      "Name, summary, complaint type and received date are required; everything else can be added later.",
    ],
  },
  {
    match: (p) => p.startsWith("/complaints/"),
    title: "Working a complaint",
    points: [
      "The regulatory clock shows the milestones and where today falls. Notes under it flag what needs attention.",
      "Actions that are not possible right now are greyed out with the reason underneath.",
      "Every action and every edit is written to the audit trail with your name and the time.",
    ],
  },
  {
    match: (p) => p.startsWith("/reports"),
    title: "Reports",
    points: [
      "Management information follows DISP 1.10 and covers complaints received in the chosen period.",
      "Whether a final response was in time is judged against each insurer's own deadline.",
      "Export CSV downloads the same figures for further analysis.",
    ],
  },
  {
    match: (p) => p.startsWith("/settings"),
    title: "Settings",
    points: [
      "Managers maintain firm settings, insurer deadlines, coverholders, reference lists, users and bank holidays.",
      "A deadline that goes beyond what the FCA allows is accepted but flagged with a warning.",
      "Changes apply straight away to every open complaint.",
    ],
  },
  {
    match: (p) => p.startsWith("/framework"),
    title: "Framework",
    points: ["A read only summary of the rules the application enforces, generated from the rules engine and the current insurer profiles."],
  },
];

const DEFAULT_HELP = {
  title: "How it works",
  points: ["Complaints Management tracks each complaint against the FCA DISP timeline from receipt to closure."],
};

/** Floating "How it works" panel, bottom right on every page. */
export function HelpPanel() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const help = HELP.find((h) => h.match(pathname)) ?? DEFAULT_HELP;

  return (
    <div className={styles.wrap}>
      {open && (
        <section id="help-panel" className={styles.panel} aria-label="How it works">
          <h2>{help.title}</h2>
          <ul>
            {help.points.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </section>
      )}
      <button type="button" className={styles.button} aria-expanded={open} aria-controls="help-panel" onClick={() => setOpen((o) => !o)}>
        {open ? "Close help" : "How it works"}
      </button>
    </div>
  );
}
