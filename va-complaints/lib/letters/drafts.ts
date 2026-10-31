import "server-only";
import { buildView } from "@/lib/complaints/view";
import type { Db } from "@/lib/db/client";
import { getComplaint } from "@/lib/db/complaints";
import { createNotificationDraft } from "@/lib/db/notifications";
import { getFirmSettings, listBankHolidays, listInsurers } from "@/lib/db/settings";
import type { NotificationType } from "@/lib/domain/complaint";
import { todayUtc } from "@/lib/rules";
import { letterInputFor } from "./input";
import { renderLetter } from "./templates";

/**
 * Renders a letter from the complaint as it is now and stores it as a draft. Email when the
 * complainant has an email address, otherwise a printed letter.
 */
export async function createDraftFor(db: Db, complaintId: string, type: NotificationType): Promise<string> {
  const [complaint, firm, insurers, holidays] = await Promise.all([
    getComplaint(db, complaintId),
    getFirmSettings(db),
    listInsurers(db),
    listBankHolidays(db),
  ]);
  const today = todayUtc();
  const view = buildView(complaint, { firm, insurers, holidays, profiles: [] }, today);
  const letter = renderLetter(letterInputFor(type, view, firm, today));
  return createNotificationDraft(db, {
    complaintId,
    type,
    channel: complaint.complainant_email ? "email" : "letter",
    content: `${letter.subject}\n\n${letter.body}`,
    recipientEmail: complaint.complainant_email,
  });
}
