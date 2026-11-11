import type { ComplaintEventRow } from "@/lib/db/types";
import { LETTER_TITLES } from "@/lib/letters/templates";

/**
 * Audit entries in plain words. Recording a step ("Acknowledgement recorded") and sending its
 * letter ("Acknowledgement letter sent by email") are different events, so they are worded
 * differently and letter entries name the letter.
 */
const STEP_TEXT: Record<string, string> = {
  acknowledged: "Acknowledgement recorded",
  holding_response_sent: "Holding response recorded",
  final_response_sent: "Final response recorded",
};

export function describeEvent(e: Pick<ComplaintEventRow, "event_type" | "description" | "after">): string {
  if (STEP_TEXT[e.event_type]) return STEP_TEXT[e.event_type];
  if (!e.event_type.startsWith("notification_") && !e.event_type.startsWith("attachment_")) return e.description;

  const type = typeof e.after?.type === "string" ? (e.after.type as keyof typeof LETTER_TITLES) : null;
  const letter = type && LETTER_TITLES[type] ? `${LETTER_TITLES[type]} letter` : "Letter";
  const byEmail = e.after?.channel === "email";
  const file = typeof e.after?.file_name === "string" ? `: ${e.after.file_name}` : "";
  switch (e.event_type) {
    case "attachment_added":
      return `Attachment added to the ${letter.toLowerCase()}${file}`;
    case "attachment_removed":
      return `Attachment removed from the ${letter.toLowerCase()}${file}`;
    case "notification_created":
      return `${letter} drafted`;
    case "notification_updated":
      return `${letter} draft edited`;
    case "notification_sent":
      return byEmail ? `${letter} sent by email` : `${letter} issued as a printed letter`;
    case "notification_failed":
      return `${letter} could not be sent by email`;
    default:
      return e.description;
  }
}
