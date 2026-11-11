/** Release notes shown on the What's new page. Newest first. Keep APP_VERSION equal to the first entry. */
export const APP_VERSION = "0.6.2";

export interface Release {
  version: string;
  date: string;
  title: string;
  changes: string[];
}

export const CHANGELOG: Release[] = [
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
