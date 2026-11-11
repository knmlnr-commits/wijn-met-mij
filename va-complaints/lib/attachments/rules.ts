/**
 * What may be attached to a letter or email. Pure, so the browser hint, the server action and
 * the tests use one definition; the database enforces the same limits again
 * (app.attachment_* in supabase/migrations; a database test keeps the two in step).
 */

export const ATTACHMENT_MAX_BYTES = 3 * 1024 * 1024;
export const ATTACHMENT_MAX_PER_NOTIFICATION = 5;
/** One upload request has to stay under the platform's request limit. */
export const ATTACHMENT_MAX_REQUEST_BYTES = 3.5 * 1024 * 1024;

export const ATTACHMENT_TYPES = [
  { contentType: "application/pdf", extensions: ["pdf"], label: "PDF" },
  { contentType: "image/png", extensions: ["png"], label: "PNG" },
  { contentType: "image/jpeg", extensions: ["jpg", "jpeg"], label: "JPG" },
  { contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", extensions: ["docx"], label: "Word (docx)" },
  { contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", extensions: ["xlsx"], label: "Excel (xlsx)" },
] as const;

export const ATTACHMENT_ACCEPT = ATTACHMENT_TYPES.flatMap((t) => t.extensions.map((e) => `.${e}`)).join(",");
export const ATTACHMENT_HINT = `${ATTACHMENT_TYPES.map((t) => t.label).join(", ")}; at most ${ATTACHMENT_MAX_PER_NOTIFICATION} files of ${ATTACHMENT_MAX_BYTES / 1024 / 1024} MB each.`;

/** The first bytes every file of a type starts with; docx and xlsx are zip files. */
const SIGNATURES: Record<string, number[]> = {
  "application/pdf": [0x25, 0x50, 0x44, 0x46],
  "image/png": [0x89, 0x50, 0x4e, 0x47],
  "image/jpeg": [0xff, 0xd8, 0xff],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [0x50, 0x4b, 0x03, 0x04],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [0x50, 0x4b, 0x03, 0x04],
};

export interface CheckedAttachment {
  fileName: string;
  contentType: string;
}

/** Keeps the last path part and removes characters that do not belong in a file name. */
export function cleanFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  return base.replace(/[\u0000-\u001f\u007f:*?"<>|]/g, "").replace(/\s+/g, " ").trim().slice(0, 200);
}

/**
 * Checks one file. The type is decided by the extension, never by what the browser claims, and
 * the content has to start the way that type does. Returns the problem as text, or the cleaned
 * name and the content type to store.
 */
export function checkAttachment(file: { name: string; size: number }, head: Uint8Array): CheckedAttachment | string {
  const fileName = cleanFileName(file.name);
  const shown = fileName || "The file";
  const extension = fileName.includes(".") ? fileName.split(".").pop()!.toLowerCase() : "";
  const type = ATTACHMENT_TYPES.find((t) => (t.extensions as readonly string[]).includes(extension));
  if (!fileName || !type) return `${shown} cannot be attached. Allowed: ${ATTACHMENT_TYPES.map((t) => t.label).join(", ")}.`;
  if (file.size === 0) return `${shown} is empty.`;
  if (file.size > ATTACHMENT_MAX_BYTES) return `${shown} is larger than ${ATTACHMENT_MAX_BYTES / 1024 / 1024} MB.`;
  const signature = SIGNATURES[type.contentType];
  if (!signature.every((byte, i) => head[i] === byte)) return `${shown} does not look like a ${type.label} file.`;
  return { fileName, contentType: type.contentType };
}

/** Checks a set of files for one notification that already holds `existing` attachments. */
export function checkAttachmentSet(files: { size: number }[], existing: number): string | null {
  if (existing + files.length > ATTACHMENT_MAX_PER_NOTIFICATION) {
    return `A letter or email can carry at most ${ATTACHMENT_MAX_PER_NOTIFICATION} attachments.`;
  }
  if (files.reduce((sum, f) => sum + f.size, 0) > ATTACHMENT_MAX_REQUEST_BYTES) {
    return "Together these files are too large to upload at once. Add them one at a time.";
  }
  return null;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
