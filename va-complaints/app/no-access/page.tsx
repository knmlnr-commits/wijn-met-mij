import type { Metadata } from "next";
import Link from "next/link";
import { getSessionState } from "@/lib/auth/session";

export const metadata: Metadata = { title: "No access | Van Ameyde Complaints Management" };

export default async function NoAccessPage({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  const { reason } = await searchParams;
  const state = await getSessionState();
  const wrongRole = reason === "role" && state.kind === "active";

  return (
    <section className="card">
      <h1>{wrongRole ? "Not permitted" : "No access yet"}</h1>
      {wrongRole ? (
        <p>Your role does not give access to that page.</p>
      ) : (
        <p>
          You are signed in, but your account has not been given access to Complaints Management. Ask a Manager to
          add you as a user or to reactivate your account.
        </p>
      )}
      {wrongRole ? (
        <p>
          <Link href="/">Back to the dashboard</Link>
        </p>
      ) : (
        state.kind !== "anonymous" && (
          <form action="/auth/signout" method="post">
            <button type="submit" className="button-secondary">
              Sign out
            </button>
          </form>
        )
      )}
    </section>
  );
}
