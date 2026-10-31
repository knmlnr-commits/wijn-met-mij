import { describe, expect, it } from "vitest";
import { NOTIFICATION_TYPES } from "@/lib/domain/complaint";
import { redactEmail } from "@/lib/email/redact";
import { letterInputFor } from "@/lib/letters/input";
import { splitStoredLetter } from "@/lib/letters/stored";
import { hasPlaceholders, type LetterInput, renderLetter } from "@/lib/letters/templates";
import { buildView } from "@/lib/complaints/view";
import { CONTEXT, complaintRow, FIRM } from "./fixtures";

// Synthetic wording for tests only; the real wording comes from spec section 4 via Settings.
const FOS = "TEST FOS WORDING PARAGRAPH.";
const LLOYDS = "TEST LLOYDS WORDING PARAGRAPH.";
const TODAY = "2026-10-31";

function input(overrides: { type: LetterInput["type"]; lloyds?: boolean; wording?: boolean; holdingFos?: boolean; outcome?: LetterInput["complaint"]["outcome"] }): LetterInput {
  return {
    type: overrides.type,
    today: TODAY,
    firm: {
      name: "Van Ameyde",
      shortName: "Van Ameyde",
      fosWording: overrides.wording === false ? null : FOS,
      lloydsWording: overrides.wording === false ? null : LLOYDS,
      fosContact: null,
    },
    insurer: { name: overrides.lloyds ? "Lloyd's" : "Zurich", isLloyds: Boolean(overrides.lloyds) },
    complaint: {
      reference: "C-000042",
      complainantName: "Demo Complainant",
      address: ["1 Test Street", null, "Testtown", null, "ZZ1 1ZZ", "United Kingdom"],
      receivedDate: "2026-10-01",
      claimReference: "DEMO-CLM-42",
      findings: "Synthetic findings.",
      outcome: overrides.outcome === undefined ? "partially_upheld" : overrides.outcome,
      upheldAgainst: "firm",
      compensationAmount: 120.5,
      compensationPaidBy: "firm",
    },
    timeline: { finalResponseDeadline: "2026-11-26", holdingRequiresFosRights: Boolean(overrides.holdingFos), fosWindowEnd: "2027-04-30" },
  };
}

describe("letter templates", () => {
  it.each(NOTIFICATION_TYPES)("%s carries the reference, the firm and dd-mm-yyyy dates", (type) => {
    const { body, subject } = renderLetter(input({ type }));
    expect(subject).toContain("C-000042");
    expect(body).toContain("Our reference: C-000042");
    expect(body).toContain("Van Ameyde");
    expect(body).toContain("31-10-2026");
    expect(body).not.toMatch(/undefined|null|NaN/);
  });

  it("acknowledgement states the final response deadline and carries no referral wording", () => {
    const { body, missing } = renderLetter(input({ type: "acknowledgement", wording: false }));
    expect(body).toContain("received your complaint on 01-10-2026");
    expect(body).toContain("no later than 26-11-2026");
    expect(missing).toEqual([]);
  });

  it("holding response gives FOS rights only once the deadline is reached", () => {
    expect(renderLetter(input({ type: "holding" })).body).not.toContain(FOS);
    const late = renderLetter(input({ type: "holding", holdingFos: true }));
    expect(late.body).toContain(FOS);
    expect(late.body).toContain("You do not have to wait for our final response.");
  });

  it("non Lloyd's letters carry the FOS wording only", () => {
    const { body } = renderLetter(input({ type: "final_response" }));
    expect(body).toContain(FOS);
    expect(body).not.toContain(LLOYDS);
  });

  it("Lloyd's letters carry the Lloyd's wording followed by the FOS paragraph", () => {
    const { body } = renderLetter(input({ type: "final_response", lloyds: true }));
    expect(body.indexOf(LLOYDS)).toBeGreaterThan(-1);
    expect(body.indexOf(FOS)).toBeGreaterThan(body.indexOf(LLOYDS));
  });

  it("final response states the outcome, findings, compensation in GBP and the FOS date", () => {
    const { body } = renderLetter(input({ type: "final_response" }));
    expect(body).toContain("we uphold your complaint in part");
    expect(body).toContain("Synthetic findings.");
    expect(body).toContain("We will pay you £120.50.");
    expect(body).toContain("should be made by 30-04-2027");
  });

  it("summary resolution confirms resolution and carries referral wording", () => {
    const { body } = renderLetter(input({ type: "summary_resolution", lloyds: true }));
    expect(body).toContain("we now consider your complaint resolved");
    expect(body).toContain(LLOYDS);
    expect(body).toContain(FOS);
  });

  it("marks missing wording and a missing outcome as placeholders that block sending", () => {
    const r = renderLetter(input({ type: "final_response", lloyds: true, wording: false, outcome: null }));
    expect([...r.missing].sort()).toEqual(["FOS referral wording", "Lloyd's referral wording", "Outcome"]);
    expect(hasPlaceholders(r.body)).toBe(true);
    expect(hasPlaceholders(renderLetter(input({ type: "final_response" })).body)).toBe(false);
  });

  it("never uses the long dash or en dash in any letter (house style)", () => {
    const dash = new RegExp("[\\u2013\\u2014]");
    for (const type of NOTIFICATION_TYPES) {
      for (const lloyds of [false, true]) {
        for (const wording of [false, true]) {
          for (const holdingFos of [false, true]) {
            const { body, subject } = renderLetter(input({ type, lloyds, wording, holdingFos }));
            expect(dash.test(body) || dash.test(subject), `${type} ${lloyds} ${wording} ${holdingFos}`).toBe(false);
          }
        }
      }
    }
  });

  it("builds the letter input from a complaint view", () => {
    const view = buildView(complaintRow({ insurer_id: "ins-Lloyd's", compensation_amount: 75, outcome: "upheld" }), CONTEXT, TODAY);
    const i = letterInputFor("final_response", view, { ...FIRM, fos_wording: FOS }, TODAY);
    expect(i.insurer).toEqual({ name: "Lloyd's", isLloyds: true });
    expect(i.complaint.compensationAmount).toBe(75);
    expect(i.firm.fosWording).toBe(FOS);
  });
});

describe("stored letters and email", () => {
  it("splits the subject line from the text", () => {
    expect(splitStoredLetter("Subject line\n\nDear Demo,\n\nText")).toEqual({ subject: "Subject line", text: "Dear Demo,\n\nText" });
    expect(splitStoredLetter("No subject")).toEqual({ subject: "Your complaint", text: "No subject" });
  });

  it("redacts addresses in delivery logs", () => {
    expect(redactEmail("demo01@example.test")).toBe("d***@example.test");
    expect(redactEmail("not-an-address")).toBe("***");
  });
});
