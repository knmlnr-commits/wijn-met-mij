import type { NotificationType, Outcome, Party } from "@/lib/domain/complaint";
import { formatDate, formatGBP } from "@/lib/format";
import type { IsoDate } from "@/lib/rules";

/**
 * The four DISP customer communications as plain text, for the handler to review and edit
 * before sending. Referral wording comes from firm settings (spec section 4): the FOS wording
 * for non Lloyd's insurers; the Lloyd's wording followed by the FOS eligibility paragraph when
 * the insurer is a Lloyd's insurer. Missing wording is shown as a marked placeholder and
 * blocks sending, so a letter can never go out without the referral rights.
 */

export const PLACEHOLDER_START = "[[";
export const PLACEHOLDER_END = "]]";

export const LETTER_TITLES: Record<NotificationType, string> = {
  acknowledgement: "Acknowledgement",
  holding: "Holding response",
  summary_resolution: "Summary resolution communication",
  final_response: "Final response",
};

export interface LetterInput {
  type: NotificationType;
  today: IsoDate;
  firm: { name: string; shortName: string; fosWording: string | null; lloydsWording: string | null; fosContact: string | null };
  insurer: { name: string; isLloyds: boolean };
  complaint: {
    reference: string;
    complainantName: string;
    address: (string | null)[];
    receivedDate: IsoDate;
    claimReference: string | null;
    findings: string | null;
    outcome: Outcome | null;
    upheldAgainst: Party | null;
    compensationAmount: number | null;
    compensationPaidBy: Party | null;
  };
  timeline: {
    finalResponseDeadline: IsoDate;
    holdingRequiresFosRights: boolean;
    fosWindowEnd: IsoDate | null;
  };
}

export interface RenderedLetter {
  subject: string;
  body: string;
  /** Settings that still need a value before this letter may be sent. */
  missing: string[];
}

function placeholder(text: string): string {
  return `${PLACEHOLDER_START}${text}${PLACEHOLDER_END}`;
}

export function hasPlaceholders(text: string): boolean {
  return text.includes(PLACEHOLDER_START);
}

const OUTCOME_SENTENCES: Record<Outcome, string> = {
  upheld: "we uphold your complaint",
  partially_upheld: "we uphold your complaint in part",
  not_upheld: "we do not uphold your complaint",
};

export function renderLetter(input: LetterInput): RenderedLetter {
  const { type, firm, insurer, complaint: c, timeline: t } = input;
  const missing: string[] = [];

  const fos = (): string => {
    if (firm.fosWording?.trim()) return firm.fosWording.trim();
    if (!missing.includes("FOS referral wording")) missing.push("FOS referral wording");
    return placeholder("FOS referral wording is not configured. A Manager adds it in Settings before this letter can be sent.");
  };
  const lloyds = (): string => {
    if (firm.lloydsWording?.trim()) return firm.lloydsWording.trim();
    if (!missing.includes("Lloyd's referral wording")) missing.push("Lloyd's referral wording");
    return placeholder("Lloyd's referral wording is not configured. A Manager adds it in Settings before this letter can be sent.");
  };
  const referral = (): string[] => {
    const blocks = insurer.isLloyds ? [lloyds(), fos()] : [fos()];
    if (firm.fosContact?.trim()) blocks.push(firm.fosContact.trim());
    return blocks;
  };

  const refLine = [`Our reference: ${c.reference}`, c.claimReference ? `Claim reference: ${c.claimReference}` : null]
    .filter(Boolean)
    .join("\n");
  const header = [firm.name, "", formatDate(input.today), "", c.complainantName, ...c.address.filter((l): l is string => Boolean(l?.trim())), "", refLine, ""];
  const greeting = `Dear ${c.complainantName},`;
  const signOff = ["Yours sincerely,", "", `Complaints Team, ${firm.name}`, `On behalf of ${insurer.name}`];

  let subject: string;
  let paragraphs: string[];

  switch (type) {
    case "acknowledgement":
      subject = `Your complaint ${c.reference}: acknowledgement`;
      paragraphs = [
        `Thank you for contacting us. We received your complaint on ${formatDate(c.receivedDate)} and we are now looking into it.`,
        `We aim to send you our final response as soon as possible, and no later than ${formatDate(t.finalResponseDeadline)}. If we need more time we will write to explain why.`,
        "If you have anything that may help us, please reply quoting the reference above.",
      ];
      break;

    case "holding":
      subject = `Your complaint ${c.reference}: update`;
      paragraphs = [
        "We are writing to update you on your complaint.",
        t.holdingRequiresFosRights
          ? "We are sorry that we have not yet been able to give you our final response. We are still investigating, and we will write again as soon as our review is complete."
          : `We are still investigating your complaint. We aim to send our final response by ${formatDate(t.finalResponseDeadline)} and will keep you informed.`,
        ...(t.holdingRequiresFosRights
          ? ["Because we have not been able to send our final response within the time allowed, you may now refer your complaint as set out below. You do not have to wait for our final response.", ...referral()]
          : []),
        "Thank you for your patience.",
      ];
      break;

    case "summary_resolution":
      subject = `Your complaint ${c.reference}: resolved`;
      paragraphs = [
        "Thank you for raising your concern with us. We are pleased that we have been able to resolve it, and this letter confirms that we now consider your complaint resolved.",
        ...(c.findings?.trim() ? [c.findings.trim()] : []),
        "If you later feel that the matter has not been resolved, you may be able to refer your complaint as set out below.",
        ...referral(),
      ];
      break;

    case "final_response": {
      subject = `Your complaint ${c.reference}: our final response`;
      const outcome = c.outcome
        ? `Having investigated your complaint, ${OUTCOME_SENTENCES[c.outcome]}.`
        : placeholder("Record the outcome of the complaint before sending this letter.");
      if (!c.outcome) missing.push("Outcome");
      const compensation =
        c.compensationAmount && c.compensationAmount > 0
          ? [`We will pay you ${formatGBP(c.compensationAmount)}${c.compensationPaidBy === "insurer" ? ` on behalf of ${insurer.name}` : ""}.`]
          : [];
      paragraphs = [
        "This is our final response to your complaint.",
        outcome,
        ...(c.findings?.trim() ? [c.findings.trim()] : []),
        ...compensation,
        "If you are not satisfied with our final response, you may refer your complaint as set out below.",
        ...referral(),
        ...(t.fosWindowEnd ? [`For your reference, a referral to the Financial Ombudsman Service should be made by ${formatDate(t.fosWindowEnd)}.`] : []),
      ];
      break;
    }
  }

  const body = [...header, greeting, "", ...paragraphs.flatMap((p) => [p, ""]), ...signOff].join("\n");
  return { subject, body, missing };
}
