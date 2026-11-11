"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { helpFor } from "@/lib/help";
import styles from "./HelpPanel.module.css";

/** Floating "How it works" panel, bottom right on every page: explains the screen you are on. */
export function HelpPanel() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const help = helpFor(pathname);

  return (
    <div className={styles.wrap}>
      {open && (
        <section id="help-panel" className={styles.panel} aria-label="How it works">
          <h2>{help.title}</h2>
          <p>{help.purpose}</p>
          {help.steps.length > 0 && (
            <>
              <h3>What to do here</h3>
              <ol>
                {help.steps.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
            </>
          )}
          {help.tips.length > 0 && (
            <>
              <h3>Good to know</h3>
              <ul>
                {help.tips.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </>
          )}
          <p>
            <Link href="/guide" onClick={() => setOpen(false)}>
              See the whole process, step by step
            </Link>
          </p>
        </section>
      )}
      <button type="button" className={styles.button} aria-expanded={open} aria-controls="help-panel" onClick={() => setOpen((o) => !o)}>
        {open ? "Close help" : "How it works"}
      </button>
    </div>
  );
}
