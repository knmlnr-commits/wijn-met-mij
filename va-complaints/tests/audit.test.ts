import { describe, expect, it } from "vitest";
import { describeEvent } from "@/lib/complaints/audit";

const e = (event_type: string, after: Record<string, unknown> | null = null, description = "x") => ({ event_type, description, after });

describe("audit trail wording", () => {
  it("separates recording a step from sending its letter", () => {
    expect(describeEvent(e("acknowledged"))).toBe("Acknowledgement recorded");
    expect(describeEvent(e("notification_created", { type: "acknowledgement", channel: "email" }))).toBe("Acknowledgement letter drafted");
    expect(describeEvent(e("notification_sent", { type: "acknowledgement", channel: "email" }))).toBe("Acknowledgement letter sent by email");
    expect(describeEvent(e("notification_sent", { type: "final_response", channel: "letter" }))).toBe("Final response letter issued as a printed letter");
  });

  it("falls back to the stored description for other events and older letter entries", () => {
    expect(describeEvent(e("closed", null, "Complaint closed"))).toBe("Complaint closed");
    expect(describeEvent(e("notification_updated", { channel: "email" }))).toBe("Letter draft edited");
  });
});
