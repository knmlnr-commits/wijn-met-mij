import type { Metadata } from "next";
import { requirePageUser } from "@/lib/auth/session";
import { createUserClient } from "@/lib/db/client";
import { loadContext } from "@/lib/db/context";
import { holidayDates, todayUtc } from "@/lib/rules";
import { RegisterForm } from "./RegisterForm";

export const metadata: Metadata = { title: "Register | Van Ameyde Complaints Management" };

export default async function RegisterPage() {
  const user = await requirePageUser("handler", "manager");
  const db = await createUserClient();
  const ctx = await loadContext(db);
  const options = (rows: { code: string; label: string; is_active: boolean }[]) =>
    rows.filter((r) => r.is_active).map((r) => ({ value: r.code, label: r.label }));

  return (
    <div className="stack">
      <div className="page-header">
        <h1>Register a complaint</h1>
      </div>
      <RegisterForm
        today={todayUtc()}
        userId={user.id}
        insurers={ctx.insurers.filter((i) => i.is_active)}
        firm={ctx.firm}
        holidays={holidayDates(ctx.holidays, ctx.firm?.bank_holidays_enabled ?? true)}
        handlers={ctx.profiles.filter((p) => p.is_active && p.role !== "compliance").map((p) => ({ value: p.id, label: p.display_name }))}
        coverholders={ctx.coverholders.filter((c) => c.is_active).map((c) => ({ value: c.id, label: c.name }))}
        lists={{
          complainantType: options(ctx.refs.ref_complainant_type),
          product: options(ctx.refs.ref_product),
          channel: options(ctx.refs.ref_channel),
          nature: options(ctx.refs.ref_nature_of_complaint),
          rootCause: options(ctx.refs.ref_root_cause),
          secondaryCause: options(ctx.refs.ref_secondary_cause),
          vulnerability: options(ctx.refs.ref_vulnerability_category),
        }}
      />
    </div>
  );
}
