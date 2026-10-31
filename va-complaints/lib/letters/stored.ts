/** A stored notification is the subject line, a blank line, then the letter text. */
export function splitStoredLetter(content: string): { subject: string; text: string } {
  const normalised = content.replace(/\r\n/g, "\n");
  const index = normalised.indexOf("\n\n");
  if (index === -1) return { subject: "Your complaint", text: normalised };
  return { subject: normalised.slice(0, index).trim() || "Your complaint", text: normalised.slice(index + 2) };
}
