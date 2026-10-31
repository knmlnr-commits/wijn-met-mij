"use client";

/** Shown when a page fails. Never shows error details, which could contain personal data. */
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section className="card stack">
      <h1>Something went wrong</h1>
      <p>The page could not be loaded. Please try again; if it keeps happening, tell the service desk the time it happened.</p>
      <div className="button-row">
        <button type="button" className="button-primary" onClick={reset}>
          Try again
        </button>
      </div>
    </section>
  );
}
