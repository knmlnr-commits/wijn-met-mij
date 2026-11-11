import { PDFDocument, StandardFonts } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { letterPdf, letterPdfFileName, pdfSafe, wrapLetter } from "@/lib/letters/pdf";

const text = ["Dear Synthetic Person,", "", "Thank you for your complaint. ".repeat(12).trim(), "", "Yours sincerely,", "Demo Handler"].join("\n");

describe("letter PDF", () => {
  it("produces a valid one page A4 PDF with the subject as title", async () => {
    const bytes = await letterPdf({ subject: "Your complaint C-000001", text, draft: false });
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe("%PDF-");
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
    expect(doc.getTitle()).toBe("Your complaint C-000001");
    expect(Math.round(doc.getPage(0).getWidth())).toBe(595);
  });

  it("continues a long letter on further pages", async () => {
    const long = Array.from({ length: 140 }, (_, i) => `Line ${i + 1}`).join("\n");
    const doc = await PDFDocument.load(await letterPdf({ subject: "Long", text: long, draft: true }));
    expect(doc.getPageCount()).toBe(3);
  });

  it("wraps to the page width and keeps blank lines and line breaks", async () => {
    const font = await (await PDFDocument.create()).embedFont(StandardFonts.Helvetica);
    const lines = wrapLetter(text, font, 10.5, 470);
    expect(lines[0]).toBe("Dear Synthetic Person,");
    expect(lines[1]).toBe("");
    expect(lines.at(-1)).toBe("Demo Handler");
    expect(lines.every((l) => font.widthOfTextAtSize(l, 10.5) <= 470)).toBe(true);
    expect(lines.join(" ").replace(/\s+/g, " ")).toBe(text.replace(/\s+/g, " "));
    expect(wrapLetter("x".repeat(400), font, 10.5, 470).every((l) => font.widthOfTextAtSize(l, 10.5) <= 470)).toBe(true);
  });

  it("replaces characters the PDF font cannot show instead of failing", async () => {
    const font = await (await PDFDocument.create()).embedFont(StandardFonts.Helvetica);
    expect(pdfSafe("Redress of £120.50 for Zoë", font)).toBe("Redress of £120.50 for Zoë");
    expect(pdfSafe("Smile \u{1F600}\tend\r\nnext", font)).toBe("Smile ?    end\nnext");
    await expect(letterPdf({ subject: "你", text: "你好", draft: false })).resolves.toBeInstanceOf(Uint8Array);
  });

  it("names the file by letter type and date, without personal data", () => {
    expect(letterPdfFileName("final_response", "2026-11-11T09:30:00Z", false)).toBe("final-response-11-11-2026.pdf");
    expect(letterPdfFileName("acknowledgement", "2026-06-01T09:30:00Z", true)).toBe("acknowledgement-01-06-2026-draft.pdf");
  });
});
