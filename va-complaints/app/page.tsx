import { ROLE_LABELS } from "@/lib/auth/roles";
import { requirePageUser } from "@/lib/auth/session";

export default async function HomePage() {
  const user = await requirePageUser();
  return (
    <section className="card">
      <h1>Complaints Management</h1>
      <p>
        Signed in as {user.displayName} ({ROLE_LABELS[user.role]}). The dashboard, registration and complaint screens
        arrive in phase 4.
      </p>
    </section>
  );
}
