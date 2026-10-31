import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePageUser } from "@/lib/auth/session";
import { createUserClient } from "@/lib/db/client";
import { DataError } from "@/lib/db/errors";
import { getNotification } from "@/lib/db/notifications";
import type { NotificationRow } from "@/lib/db/types";
import { splitStoredLetter } from "@/lib/letters/stored";
import { PrintButton } from "./PrintButton";
import styles from "./letter.module.css";

export const metadata: Metadata = { title: "Letter | Van Ameyde Complaints Management" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Printable view of a stored letter: exactly the content that was issued. */
export default async function LetterPage({ params }: { params: Promise<{ id: string; nid: string }> }) {
  await requirePageUser();
  const { id, nid } = await params;
  if (!UUID.test(id) || !UUID.test(nid)) notFound();
  let n: NotificationRow;
  try {
    n = await getNotification(await createUserClient(), nid);
  } catch (error) {
    if (error instanceof DataError && error.kind === "not_found") notFound();
    throw error;
  }
  if (n.complaint_id !== id) notFound();
  const { text } = splitStoredLetter(n.rendered_content);

  return (
    <article className={styles.page}>
      <div className={styles.toolbar}>
        <PrintButton />
        {n.status !== "sent" && <span className="badge badge-rose">Draft, not yet issued</span>}
      </div>
      <pre className={styles.letter}>{text}</pre>
    </article>
  );
}
