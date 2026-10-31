"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import styles from "./Nav.module.css";

export interface NavLinkItem {
  href: string;
  label: string;
}

/** Main navigation; collapses behind a menu button on phones. */
export function Nav({ links }: { links: NavLinkItem[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const active = (href: string) => (href === "/" ? pathname === "/" || pathname.startsWith("/complaints") : pathname.startsWith(href));

  return (
    <nav className={styles.nav} aria-label="Main">
      <button
        type="button"
        className={styles.toggle}
        aria-expanded={open}
        aria-controls="main-nav"
        onClick={() => setOpen((o) => !o)}
      >
        <span aria-hidden="true">&#9776;</span> Menu
      </button>
      <ul id="main-nav" className={`${styles.list} ${open ? styles.open : ""}`}>
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className={active(l.href) ? styles.active : undefined} onClick={() => setOpen(false)} aria-current={active(l.href) ? "page" : undefined}>
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
