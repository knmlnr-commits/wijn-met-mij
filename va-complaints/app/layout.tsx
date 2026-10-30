import type { Metadata } from "next";
import Image from "next/image";
import { appVersion } from "@/lib/version";
import "./globals.css";

export const metadata: Metadata = {
  title: "Van Ameyde Complaints Management",
  description: "Internal complaints handling within the FCA DISP timeline.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { sha, env } = appVersion();
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
          <span className="version-chip" title="Build version and environment">
            {sha} · {env}
          </span>
        </header>
        <main className="content">{children}</main>
      </body>
    </html>
  );
}
