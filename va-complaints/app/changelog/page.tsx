import type { Metadata } from "next";
import { requirePageUser } from "@/lib/auth/session";
import { APP_VERSION, CHANGELOG } from "@/lib/changelog";
import { appVersion } from "@/lib/version";

export const metadata: Metadata = { title: "What's new | Van Ameyde Complaints Management" };

export default async function ChangelogPage() {
  await requirePageUser();
  const { sha, env } = appVersion();
  return (
    <div className="stack">
      <div className="page-header">
        <h1>What&apos;s new</h1>
      </div>
      <p className="muted">
        You are using version {APP_VERSION} (build {sha}, {env}). This is a release candidate with synthetic demo data.
      </p>
      {CHANGELOG.map((r, i) => (
        <section key={r.version} className="card stack">
          <h2>
            Version {r.version}: {r.title} {i === 0 && <span className="badge">Current</span>}
          </h2>
          <p className="small muted">{r.date}</p>
          <ul>
            {r.changes.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
