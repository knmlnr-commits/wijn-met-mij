"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./reports.module.css";

/**
 * Multi-select for the insurer filter. Sits inside the report form; the choice travels in one
 * query parameter (insurer=Zurich,AXA), so a report can be shared as a link.
 */
export function InsurerFilter({ options, selected }: { options: string[]; selected: string[] }) {
  const [chosen, setChosen] = useState<string[]>(selected);
  const all = chosen.length === 0 || chosen.length === options.length;
  const summary = all ? "All insurers" : chosen.length === 1 ? chosen[0] : `${chosen.length} insurers`;

  const box = useRef<HTMLDetailsElement>(null);

  // Close the list on a click elsewhere or on Escape. On click, not pointer down: closing earlier
  // would move the page under the pointer and the click on Update report would miss.
  useEffect(() => {
    const close = (event: Event) => {
      const el = box.current;
      if (!el?.open) return;
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !el.contains(event.target as Node)) el.open = false;
    };
    document.addEventListener("click", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("click", close);
      document.removeEventListener("keydown", close);
    };
  }, []);

  function toggle(name: string, on: boolean) {
    setChosen((current) => options.filter((o) => (o === name ? on : current.includes(o))));
  }

  return (
    <div className="field">
      <span className={styles.filterLabel} id="insurer-filter-label">
        Insurer
      </span>
      {!all && <input type="hidden" name="insurer" value={chosen.join(",")} />}
      <details className={styles.multi} ref={box}>
        <summary aria-labelledby="insurer-filter-label insurer-filter-value">
          <span id="insurer-filter-value">{summary}</span>
        </summary>
        <div className={styles.multiList} role="group" aria-labelledby="insurer-filter-label">
          <label className={styles.multiOption}>
            <input type="checkbox" checked={all} onChange={() => setChosen([])} />
            All insurers
          </label>
          {options.map((name) => (
            <label key={name} className={styles.multiOption}>
              <input type="checkbox" checked={!all && chosen.includes(name)} onChange={(e) => toggle(name, e.target.checked)} />
              {name}
            </label>
          ))}
        </div>
      </details>
    </div>
  );
}
