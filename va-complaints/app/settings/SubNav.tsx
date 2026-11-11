"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./settings.module.css";

export function SubNav({ sections }: { sections: { href: string; label: string }[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Settings sections" className={styles.tabs}>
      {sections.map((s) => {
        const active = pathname === s.href;
        return (
          <Link key={s.href} href={s.href} className={active ? styles.active : undefined} aria-current={active ? "page" : undefined}>
            {s.label}
          </Link>
        );
      })}
    </nav>
  );
}
