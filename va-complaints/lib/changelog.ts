/** Release notes shown on the What's new page. Newest first. Keep APP_VERSION equal to the first entry. */
export const APP_VERSION = "0.7.1";

export interface Release {
  version: string;
  date: string;
  title: string;
  changes: string[];
}

export const CHANGELOG: Release[] = [
  {
    version: "0.7.1",
    date: "11-11-2026",
    title: "Letters as PDF",
    changes: [
      "Download PDF on every letter: on the printable letter page and, for sent letters and emails, under Letters and emails on the complaint.",
      "The PDF holds exactly the stored text on A4; a draft is marked as not yet issued on every page. The file name carries the letter type and date, no personal data.",
    ],
  },
  {
    version: "0.7.0",
    date: "11-11-2026",
    title: "Reports: insurer filter and charts",
    changes: [
      "Filter the report on one or more insurers. The selection is part of the page address, applies to every figure and to the CSV export, and can be cleared in one click.",
      "Totals as tiles, with the share of final responses within deadline and the upheld rate highlighted (95% or more good, 85% to 95% warning, below 85% alert).",
      "A monthly trend of complaints received with the share of final responses within deadline.",
      "Breakdowns as bars with count and share of the total; outcome and upheld against as one bar split to 100%. Select an insurer bar to filter on it.",
      "A comparison table when two or more insurers are selected.",
      "The CSV export names the insurer filter in its file name and first row.",
    ],
  },
  {
    version: "0.6.3",
    date: "11-11-2026",
    title: "Fixes from the second test run",
    changes: [
      "Demo letter wording for the FOS and Lloyd's referral rights and the FOS contact details, so letters can be sent in the sandbox.",
      "A late acknowledgement stays red as a breach, with its reason, and is counted in Reports.",
      "Agreed compensation: the complaint shows Compensation outstanding until the payment is recorded, and cannot be closed before that.",
      "The status can no longer be changed by hand once a complaint is resolved.",
      "Audit trail: recording a step and sending its letter are worded differently, letter entries name the letter, and an unchanged draft no longer logs an edit.",
      "Clearer validation message for a missing complaint type; correct singular for 1 day; full labels for complainant types.",
      "Demo data with a more realistic spread across products, natures and root causes.",
    ],
  },
  {
    version: "0.6.2",
    date: "11-11-2026",
    title: "Handover and a clearer confirmation",
    changes: [
      "After an action the confirmation now stays visible at the top of Actions, with a link to the letter draft.",
      "The process flow diagram is lighter: five points on one line with the side routes underneath.",
      "Handover documents, a health check and an automated browser test of the main flow.",
    ],
  },
  {
    version: "0.6.1",
    date: "11-11-2026",
    title: "Fixes from the first test run",
    changes: [
      "Bank holidays for England and Wales 2025 to 2027 are loaded, so business day deadlines skip them.",
      "Upheld rate: one definition (upheld or partially upheld, of complaints with an outcome) and one period (last 12 months) on the dashboard and in Reports.",
      "The dashboard shows why a complaint is red, amber or green under its colour.",
      "Compensation outstanding: its own figure on the dashboard, an amber flag on the complaint, and included in Needs attention.",
      "The regulatory clock leaves out the week 4 point when it falls on or after the final deadline.",
      "Demo data: products, channels, natures, root causes, phone numbers and three vulnerable customers.",
      "How it works: a process flow diagram.",
    ],
  },
  {
    version: "0.6.0",
    date: "11-11-2026",
    title: "Usability upgrade",
    changes: [
      "Every complaint now shows its next step, on the dashboard and as a banner on the complaint page.",
      "Dashboard: views for Needs attention, Open, Resolved and closed, and All; the key figures are links; a switch for my complaints; filters folded away.",
      "Complaint page: only the actions that are possible are shown, the next one first; the letters sit next to the actions; details show only what has been recorded.",
      "Registration: four essentials first, the rest optional and folded away.",
      "How it works: explains each screen step by step, plus a page with the whole process, the deadlines, the colours and the roles.",
      "Version number in the header and this What's new page.",
    ],
  },
  {
    version: "0.5.0",
    date: "31-10-2026",
    title: "Letters and notifications",
    changes: [
      "Four letters: acknowledgement, holding response, summary resolution and final response, with FOS or Lloyd's referral wording.",
      "Recording a step creates the letter draft; review, edit, then send by email or issue as a printed letter.",
      "Email runs as a stub in the sandbox: nothing is actually sent.",
    ],
  },
  {
    version: "0.4.0",
    date: "31-10-2026",
    title: "Workflow and screens",
    changes: [
      "Dashboard, registration with a live timeline preview, complaint page with the regulatory clock, all workflow actions and the audit trail.",
      "Reports: DISP 1.10 management information with CSV export.",
      "Settings for Managers: firm, insurer deadlines, lists, users, bank holidays, retention. Framework page.",
    ],
  },
  {
    version: "0.3.0",
    date: "31-10-2026",
    title: "Sign in",
    changes: ["Invited users only: password or email link.", "Dev login for the sandbox; Microsoft sign in prepared behind a switch."],
  },
  {
    version: "0.2.0",
    date: "30-10-2026",
    title: "Database and security",
    changes: [
      "All tables, access rules per role (Handler, Manager, Compliance) and an audit trail that cannot be changed.",
      "Every workflow step is recorded together with its audit entry.",
    ],
  },
  {
    version: "0.1.0",
    date: "30-10-2026",
    title: "Rules engine",
    changes: ["FCA deadlines, business days with bank holidays, RAG status, per insurer deadlines, FOS window and retention."],
  },
];
