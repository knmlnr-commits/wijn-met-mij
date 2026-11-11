/**
 * In-app explanation, shared by the floating "How it works" panel (per screen) and the
 * How it works page (the whole process). Plain language; no regulatory numbers here, those are
 * shown from the rules engine on the page itself.
 */
export interface ScreenHelp {
  key: string;
  match: (path: string) => boolean;
  title: string;
  purpose: string;
  steps: string[];
  tips: string[];
}

export const SCREEN_HELP: ScreenHelp[] = [
  {
    key: "dashboard",
    match: (p) => p === "/",
    title: "Dashboard",
    purpose: "Your work list. It shows every complaint, what has to happen next on each one, and how close it is to its deadline.",
    steps: [
      "Start with the view Needs attention: these are the red and amber complaints.",
      "Read the Next step column; it says exactly what to do, most urgent first.",
      "Select a reference to open the complaint and do that step.",
      "Use Show only my complaints to see just your own work.",
    ],
    tips: [
      "The five figures at the top are links: select one to see those complaints.",
      "Search finds a reference, a complainant name or a claim reference. More filters narrows by status, complaint type, handler and RAG.",
      "Red means a deadline was missed; it stays red even after the late step is done, so the breach remains visible. Amber means a deadline is close or an acknowledgement is still due. Green means on track or answered in time.",
    ],
  },
  {
    key: "register",
    match: (p) => p.startsWith("/register"),
    title: "Register a complaint",
    purpose: "Records a new complaint and starts its regulatory clock.",
    steps: [
      "Choose the complaint type (the insurer). It decides which deadlines apply.",
      "Enter the date the complaint was received. This date starts the clock.",
      "Enter the complainant's name and a short summary, then select Register complaint.",
      "Add contact details and classification now or later; they are optional.",
    ],
    tips: [
      "The panel on the right shows the deadlines that will apply before you save.",
      "The received date and complaint type cannot be changed afterwards, because they set the deadlines. If they are wrong, a Manager deletes the complaint and it is registered again.",
      "Add an email address if you have one: letters are then prepared as emails.",
    ],
  },
  {
    key: "complaint",
    match: (p) => p.startsWith("/complaints/"),
    title: "Working a complaint",
    purpose: "Everything about one complaint: what to do now, the deadlines, the letters and the full history.",
    steps: [
      "Read the Next step banner at the top; its button takes you to the right action.",
      "Do the action under Actions. Only actions that are possible now are shown; the rest are under Not available yet, each with the reason.",
      "When a step needs a letter, a draft appears under Notifications. Check it, edit if needed, then send it by email or issue it as a printed letter.",
      "Repeat until the complaint is answered, then close it.",
    ],
    tips: [
      "The regulatory clock shows the five milestones and where today falls. The notes under it explain anything that needs attention.",
      "A typical complaint goes: acknowledgement, investigation, holding response if it takes longer than four weeks, final response, close.",
      "If the complaint can be settled within three business days, use Summary resolution instead of a final response.",
      "Every action and every edit is recorded in the audit trail with your name and the time. Nothing in it can be changed.",
    ],
  },
  {
    key: "reports",
    match: (p) => p.startsWith("/reports"),
    title: "Reports",
    purpose: "Management information for a period you choose, in the form the FCA rules (DISP 1.10) ask for.",
    steps: ["Choose the period by received date and select Update report.", "Read the totals and the breakdowns.", "Select Export CSV to take the same figures into Excel."],
    tips: [
      "Within deadline is judged against each insurer's own deadline, not one fixed number.",
      "The export contains totals only, no personal data.",
      "The note at the top gives the date the FCA return for the period is due.",
    ],
  },
  {
    key: "settings",
    match: (p) => p.startsWith("/settings"),
    title: "Settings",
    purpose: "Where a Manager tunes the application without a new release.",
    steps: [
      "Firm and insurers: firm details, letter wording and the deadlines per insurer.",
      "Lists: the values offered on the complaint form, such as products and root causes.",
      "Users: invite people and set their role.",
      "Bank holidays: load the official dates so business days are counted correctly.",
      "Retention: permanently remove deleted complaints once their retention period has passed.",
    ],
    tips: [
      "A deadline longer than the FCA allows is saved but flagged with a warning.",
      "Deactivate a list value instead of removing it, so existing complaints keep their classification.",
      "Letters cannot be sent until the FOS (and for Lloyd's, the Lloyd's) referral wording is filled in under Firm and insurers.",
    ],
  },
  {
    key: "framework",
    match: (p) => p.startsWith("/framework"),
    title: "Framework",
    purpose: "A read only summary of the rules the application enforces, for compliance and audit.",
    steps: ["Check the FCA default for each rule.", "Check the deadlines that apply per insurer.", "Check which bank holidays are loaded."],
    tips: ["The page is generated from the live rules and settings, so it is always current."],
  },
  {
    key: "changelog",
    match: (p) => p.startsWith("/changelog"),
    title: "What's new",
    purpose: "Lists what was added or changed in each version.",
    steps: ["The newest version is at the top.", "The version in the header tells you which one you are using."],
    tips: [],
  },
];

export const DEFAULT_HELP: ScreenHelp = {
  key: "default",
  match: () => true,
  title: "How it works",
  purpose: "Complaints Management tracks each complaint against the FCA timeline from receipt to closure.",
  steps: [],
  tips: [],
};

export function helpFor(path: string): ScreenHelp {
  return SCREEN_HELP.find((h) => h.match(path)) ?? DEFAULT_HELP;
}

/** The life of a complaint, step by step; shown on the How it works page. */
export const PROCESS: { title: string; who: string; text: string }[] = [
  { title: "Register", who: "Handler", text: "Record the complaint with its type (the insurer), the date received, the complainant and a summary. The clock starts on the received date." },
  { title: "Acknowledge", who: "Handler", text: "Send the acknowledgement within the target. Until it is sent the complaint shows amber, and red once the target has passed." },
  { title: "Resolve quickly if you can", who: "Handler", text: "If the complaint is settled within three business days, record a summary resolution. No final response is needed." },
  { title: "Investigate", who: "Handler", text: "Set the status as the work moves on: investigating, awaiting information, referred to or draft with the insurer." },
  { title: "Keep the complainant informed", who: "Handler", text: "At week four the application prompts for a holding response. If the final deadline is reached, the holding response must give the right to go to the Financial Ombudsman Service." },
  { title: "Send the final response", who: "Handler", text: "Record the outcome, who it is upheld against, any compensation and the findings. The letter carries the referral rights: FOS, or Lloyd's first for a Lloyd's insurer." },
  { title: "Handle a referral", who: "Handler", text: "If the complainant goes to Lloyd's or the FOS, record the referral and later the decision and any award." },
  { title: "Close", who: "Handler", text: "If compensation was agreed the complaint shows Compensation outstanding until the payment is recorded. Then close the complaint." },
  { title: "Oversee", who: "Manager and Compliance", text: "Managers maintain settings and users. Compliance has read only access to everything, including the audit trail and the reports." },
];
