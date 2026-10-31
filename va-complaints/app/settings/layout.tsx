import type { Metadata } from "next";
import Link from "next/link";
import { requirePageUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Settings | Van Ameyde Complaints Management" };

const SECTIONS = [
  { href: "/settings", label: "Firm and insurers" },
  { href: "/settings/lists", label: "Lists" },
  { href: "/settings/users", label: "Users" },
  { href: "/settings/holidays", label: "Bank holidays" },
  { href: "/settings/retention", label: "Retention" },
];

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  await requirePageUser("manager");
  return (
    <div className="stack">
      <div className="page-header">
        <h1>Settings</h1>
      </div>
      <nav aria-label="Settings sections" className="button-row">
        {SECTIONS.map((s) => (
          <Link key={s.href} href={s.href} className="button-secondary">
            {s.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
