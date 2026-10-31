import { ServerForm } from "@/components/ServerForm";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { requirePageUser } from "@/lib/auth/session";
import { createUserClient } from "@/lib/db/client";
import { listProfiles } from "@/lib/db/settings";
import { ROLES } from "@/lib/domain/complaint";
import { inviteUserAction, updateUserAction } from "../actions";
import { Check, Input } from "../fields";

function RoleSelect({ prefix, value }: { prefix: string; value?: string }) {
  return (
    <div className="field">
      <label htmlFor={`${prefix}-role`}>Role</label>
      <select id={`${prefix}-role`} name="role" defaultValue={value ?? "handler"}>
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {ROLE_LABELS[r]}
          </option>
        ))}
      </select>
    </div>
  );
}

export default async function UsersPage() {
  const me = await requirePageUser("manager");
  const profiles = await listProfiles(await createUserClient());

  return (
    <div className="stack">
      <section className="card stack">
        <h2>Invite a user</h2>
        <p className="small muted">
          The person receives an email with a sign in link. Handler: register and work complaints. Manager: also settings, users and deletion.
          Compliance: read only.
        </p>
        <ServerForm action={inviteUserAction} submit="Send invitation" className="form-grid">
          <Input prefix="invite" name="email" label="Email address" type="email" required />
          <Input prefix="invite" name="display_name" label="Name" required />
          <RoleSelect prefix="invite" />
        </ServerForm>
      </section>

      <section className="card stack">
        <h2>Users</h2>
        {profiles.map((p) => (
          <details key={p.id} className="card">
            <summary>
              <strong>{p.display_name}</strong> <span className="muted small">{p.email}</span> <span className="badge">{ROLE_LABELS[p.role]}</span>{" "}
              {!p.is_active && <span className="badge badge-rose">No access</span>}
            </summary>
            <ServerForm action={updateUserAction} submit="Save user" className="form-grid">
              <input type="hidden" name="id" value={p.id} />
              <Input prefix={p.id} name="display_name" label="Name" defaultValue={p.display_name} required />
              <RoleSelect prefix={p.id} value={p.role} />
              <Check name="is_active" label={p.id === me.id ? "Active (you cannot remove your own access)" : "Active (has access)"} defaultChecked={p.is_active} />
            </ServerForm>
          </details>
        ))}
      </section>
    </div>
  );
}
