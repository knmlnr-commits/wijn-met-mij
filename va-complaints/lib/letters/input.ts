import type { ComplaintView } from "@/lib/complaints/view";
import type { FirmSettingsRow } from "@/lib/db/types";
import type { NotificationType } from "@/lib/domain/complaint";
import type { IsoDate } from "@/lib/rules";
import type { LetterInput } from "./templates";

/** Maps a complaint view and the firm settings to the input of a letter template. */
export function letterInputFor(type: NotificationType, view: ComplaintView, firm: FirmSettingsRow | null, today: IsoDate): LetterInput {
  const c = view.complaint;
  return {
    type,
    today,
    firm: {
      name: firm?.firm_name ?? "Van Ameyde",
      shortName: firm?.firm_short_name ?? "Van Ameyde",
      fosWording: firm?.fos_wording ?? null,
      lloydsWording: firm?.lloyds_wording ?? null,
      fosContact: firm?.fos_contact ?? null,
    },
    insurer: { name: view.insurerName, isLloyds: view.insurer?.is_lloyds ?? false },
    complaint: {
      reference: c.reference,
      complainantName: c.complainant_name,
      address: [c.address_line1, c.address_line2, c.town, c.county, c.postcode, c.country],
      receivedDate: c.received_date,
      claimReference: c.claim_reference,
      findings: c.findings,
      outcome: c.outcome,
      upheldAgainst: c.upheld_against,
      compensationAmount: c.compensation_amount === null ? null : Number(c.compensation_amount),
      compensationPaidBy: c.compensation_paid_by,
    },
    timeline: {
      finalResponseDeadline: view.timeline.finalResponseDeadline,
      holdingRequiresFosRights: view.timeline.holdingRequiresFosRights,
      fosWindowEnd: view.timeline.fosWindowEnd,
    },
  };
}
