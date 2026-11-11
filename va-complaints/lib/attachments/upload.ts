import "server-only";
import { PolicyError } from "@/lib/complaints/policy";
import { addAttachment } from "@/lib/db/attachments";
import type { Db } from "@/lib/db/client";
import { checkAttachment, checkAttachmentSet } from "./rules";

export interface PreparedAttachment {
  fileName: string;
  contentType: string;
  bytes: Buffer;
}

/** The files chosen in a form field; an empty file input gives one empty, nameless file, which is skipped. */
export function filesFrom(form: FormData, field = "attachments"): File[] {
  return form.getAll(field).filter((v): v is File => typeof v !== "string" && (v.size > 0 || v.name !== ""));
}

/** Reads and checks the files before anything is written; throws a PolicyError that names the problem. */
export async function prepareAttachments(files: File[], existing = 0): Promise<PreparedAttachment[]> {
  const setProblem = checkAttachmentSet(files, existing);
  if (setProblem) throw new PolicyError(setProblem);
  const prepared: PreparedAttachment[] = [];
  for (const file of files) {
    const bytes = Buffer.from(await file.arrayBuffer());
    const checked = checkAttachment({ name: file.name, size: bytes.length }, bytes.subarray(0, 8));
    if (typeof checked === "string") throw new PolicyError(checked);
    prepared.push({ ...checked, bytes });
  }
  return prepared;
}

export async function storeAttachments(db: Db, notificationId: string, prepared: PreparedAttachment[]): Promise<void> {
  for (const file of prepared) await addAttachment(db, notificationId, file);
}
