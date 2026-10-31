import type { Metadata } from "next";
import Image from "next/image";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { getSessionState } from "@/lib/auth/session";
import { appVersion } from "@/lib/version";
import "./globals.css";

export const metadata: Metadata = {
  title: "Van Ameyde Complaints Management",
  description: "Internal complaints handling within the FCA DISP timeline.",
  robots: { index: false, follow: false },
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { sha, env } = appVersion();
  const session = await getSessionState();
  const user = session.kind === "active" ? session.user : null;

  return (
    <html lang="en-GB">
      <body>
        <header className="app-header">
          <div className="brand">
            <Image className="brand-logo" src="/logo.png" alt="Van Ameyde" width={38} height={38} priority />
            <div className="brand-text">
              <span className="brand-firm">Van Ameyde</span>
              <span className="brand-subtitle">Complaints Management</span>
            </div>
          </div>
          <div className="header-right">
            <span className="version-chip" title="Build version and environment">
              {sha} · {env}
            </span>
            {session.kind !== "anonymous" && (
              <div className="user-box">
                {user && (
                  <span className="user-name">
                    {user.displayName}
                    <span className="user-role">{ROLE_LABELS[user.role]}</span>
                  </span>
                )}
                <form action="/auth/signout" method="post">
                  <button type="submit" className="button-on-navy">
                    Sign out
                  </button>
                </form>
              </div>
            )}
          </div>
        </header>
        <main className="content">{children}</main>
      </body>
    </html>
  );
}
