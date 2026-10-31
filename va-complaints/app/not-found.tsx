import Link from "next/link";

export default function NotFound() {
  return (
    <section className="card stack">
      <h1>Not found</h1>
      <p>This page or complaint does not exist, or you do not have access to it.</p>
      <p>
        <Link href="/">Back to the dashboard</Link>
      </p>
    </section>
  );
}
