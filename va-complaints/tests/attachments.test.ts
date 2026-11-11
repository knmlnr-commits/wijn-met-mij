import { describe, expect, it } from "vitest";
import {
  ATTACHMENT_ACCEPT,
  ATTACHMENT_MAX_BYTES,
  ATTACHMENT_MAX_PER_NOTIFICATION,
  checkAttachment,
  checkAttachmentSet,
  cleanFileName,
  formatFileSize,
} from "@/lib/attachments/rules";
import { describeEvent } from "@/lib/complaints/audit";

const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d]);
const ZIP = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);

describe("attachment rules", () => {
  it("accepts the allowed types and decides the type by extension", () => {
    expect(checkAttachment({ name: "Policy terms.PDF", size: 1000 }, PDF)).toEqual({ fileName: "Policy terms.PDF", contentType: "application/pdf" });
    expect(checkAttachment({ name: "photo.png", size: 1000 }, PNG)).toMatchObject({ contentType: "image/png" });
    expect(checkAttachment({ name: "schedule.xlsx", size: 1000 }, ZIP)).toMatchObject({
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    expect(ATTACHMENT_ACCEPT).toBe(".pdf,.png,.jpg,.jpeg,.docx,.xlsx");
  });

  it("refuses other types, empty and oversized files, and content that does not match the extension", () => {
    expect(checkAttachment({ name: "run.exe", size: 10 }, PDF)).toMatch(/cannot be attached/);
    expect(checkAttachment({ name: "noextension", size: 10 }, PDF)).toMatch(/cannot be attached/);
    expect(checkAttachment({ name: "empty.pdf", size: 0 }, new Uint8Array())).toBe("empty.pdf is empty.");
    expect(checkAttachment({ name: "big.pdf", size: ATTACHMENT_MAX_BYTES + 1 }, PDF)).toBe("big.pdf is larger than 3 MB.");
    expect(checkAttachment({ name: "renamed.pdf", size: 10 }, PNG)).toBe("renamed.pdf does not look like a PDF file.");
    expect(checkAttachment({ name: "page.pdf", size: 10 }, new TextEncoder().encode("<html>"))).toMatch(/does not look like/);
  });

  it("cleans file names", () => {
    expect(cleanFileName("C:\\Users\\demo\\terms.pdf")).toBe("terms.pdf");
    expect(cleanFileName("../../etc/terms.pdf")).toBe("terms.pdf");
    expect(cleanFileName('a<b>:"c"\n.pdf')).toBe("abc.pdf");
    expect(cleanFileName(`${"x".repeat(300)}`).length).toBe(200);
  });

  it("limits the number and the combined size per letter", () => {
    expect(checkAttachmentSet([{ size: 10 }], 0)).toBeNull();
    expect(checkAttachmentSet([{ size: 10 }], ATTACHMENT_MAX_PER_NOTIFICATION)).toMatch(/at most 5/);
    expect(checkAttachmentSet([{ size: 2_000_000 }, { size: 2_000_000 }], 0)).toMatch(/too large to upload at once/);
  });

  it("shows sizes in plain units", () => {
    expect(formatFileSize(500)).toBe("500 bytes");
    expect(formatFileSize(20_480)).toBe("20 KB");
    expect(formatFileSize(1_572_864)).toBe("1.5 MB");
  });

  it("words the audit entries with the letter and the file", () => {
    expect(describeEvent({ event_type: "attachment_added", description: "Attachment added", after: { type: "acknowledgement", file_name: "terms.pdf" } })).toBe(
      "Attachment added to the acknowledgement letter: terms.pdf",
    );
    expect(describeEvent({ event_type: "attachment_removed", description: "Attachment removed", after: { type: "final_response", file_name: "terms.pdf" } })).toBe(
      "Attachment removed from the final response letter: terms.pdf",
    );
  });
});
