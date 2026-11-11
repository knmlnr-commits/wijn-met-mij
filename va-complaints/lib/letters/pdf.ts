import { PDFDocument, type PDFFont, rgb, StandardFonts } from "pdf-lib";

/**
 * A stored letter as an A4 PDF: exactly the text that was (or will be) issued.
 *
 * TODO(CONFIRM) fonts, see docs/OPEN_ITEMS.md item 40: a PDF can only use Verdana and Georgia
 * when the licensed font files are embedded, and those files are not part of this repository.
 * Until they are supplied the PDF uses Helvetica, the standard PDF sans serif. Printing the
 * letter from the browser keeps Verdana.
 */

const A4 = { width: 595.28, height: 841.89 };
const MARGIN = 62; // about 22 mm
const SIZE = 10.5;
const LINE = 15;
const NAVY = rgb(7 / 255, 1 / 255, 126 / 255);
const GREY = rgb(0.31, 0.31, 0.35);

export interface LetterPdfInput {
  subject: string;
  text: string;
  /** Marks every page of a letter that has not been issued. */
  draft: boolean;
}

/** Standard PDF fonts hold Windows-1252 only; anything else becomes a question mark instead of an error. */
export function pdfSafe(text: string, font: PDFFont): string {
  const known = new Set(font.getCharacterSet());
  return [...text.replace(/\r\n/g, "\n").replace(/\t/g, "    ")].map((ch) => (ch === "\n" || known.has(ch.codePointAt(0) ?? 0) ? ch : "?")).join("");
}

/** Breaks the letter into lines that fit the page width; blank lines and line breaks are kept. */
export function wrapLetter(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.replace(/\r\n/g, "\n").split("\n")) {
    let current = "";
    for (const word of paragraph.split(" ")) {
      let piece = word;
      // A single word wider than the page is cut, so nothing runs off the paper.
      while (font.widthOfTextAtSize(piece, size) > maxWidth) {
        let cut = piece.length - 1;
        while (cut > 1 && font.widthOfTextAtSize(piece.slice(0, cut), size) > maxWidth) cut -= 1;
        if (current) lines.push(current);
        lines.push(piece.slice(0, cut));
        current = "";
        piece = piece.slice(cut);
      }
      const candidate = current ? `${current} ${piece}` : piece;
      if (current && font.widthOfTextAtSize(candidate, size) > maxWidth) {
        lines.push(current);
        current = piece;
      } else {
        current = candidate;
      }
    }
    lines.push(current);
  }
  return lines;
}

export async function letterPdf(input: LetterPdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  doc.setTitle(pdfSafe(input.subject, font));
  doc.setAuthor("Van Ameyde");
  doc.setCreator("Van Ameyde Complaints Management");

  const lines = wrapLetter(pdfSafe(input.text, font), font, SIZE, A4.width - 2 * MARGIN);
  const perPage = Math.floor((A4.height - 2 * MARGIN) / LINE);
  const pageCount = Math.max(1, Math.ceil(lines.length / perPage));

  for (let p = 0; p < pageCount; p += 1) {
    const page = doc.addPage([A4.width, A4.height]);
    if (input.draft) {
      page.drawText("DRAFT, NOT YET ISSUED", { x: MARGIN, y: A4.height - 36, size: 9, font: bold, color: NAVY });
    }
    lines.slice(p * perPage, (p + 1) * perPage).forEach((line, i) => {
      page.drawText(line, { x: MARGIN, y: A4.height - MARGIN - SIZE - i * LINE, size: SIZE, font, color: rgb(0.13, 0.13, 0.16) });
    });
    if (pageCount > 1) {
      const label = `Page ${p + 1} of ${pageCount}`;
      page.drawText(label, { x: A4.width - MARGIN - font.widthOfTextAtSize(label, 8), y: 30, size: 8, font, color: GREY });
    }
  }
  return doc.save();
}

/** File name without personal data: letter type and the date it was issued or drafted. */
export function letterPdfFileName(type: string, isoTimestamp: string, draft: boolean): string {
  const day = isoTimestamp.slice(0, 10);
  const date = `${day.slice(8, 10)}-${day.slice(5, 7)}-${day.slice(0, 4)}`;
  return `${type.replace(/_/g, "-")}-${date}${draft ? "-draft" : ""}.pdf`;
}
