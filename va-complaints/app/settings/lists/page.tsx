import { ServerForm } from "@/components/ServerForm";
import { requirePageUser } from "@/lib/auth/session";
import { createUserClient } from "@/lib/db/client";
import { loadContext } from "@/lib/db/context";
import { REFERENCE_TABLES, type ReferenceTable } from "@/lib/domain/complaint";
import { saveCoverholderAction, saveReferenceAction } from "../actions";
import { Check, Input } from "../fields";

const TITLES: Record<ReferenceTable, string> = {
  ref_product: "Products",
  ref_channel: "Channels",
  ref_complainant_type: "Complainant types",
  ref_nature_of_complaint: "Nature of complaint",
  ref_root_cause: "Root causes",
  ref_secondary_cause: "Secondary causes",
  ref_vulnerability_category: "Vulnerability categories",
};

export default async function ListsPage() {
  await requirePageUser("manager");
  const ctx = await loadContext(await createUserClient());

  return (
    <div className="stack">
      <p className="muted">
        Lists used on the complaint form. Deactivate a value instead of removing it, so existing complaints keep their classification. Codes cannot be
        changed once saved; saving an existing code updates its label.
      </p>

      <section className="card stack">
        <h2>Coverholders</h2>
        {ctx.coverholders.length === 0 && <p className="muted small">No coverholders yet.</p>}
        {ctx.coverholders.map((c) => (
          <ServerForm key={c.id} action={saveCoverholderAction} submit="Save" variant="secondary" className="form-grid">
            <input type="hidden" name="id" value={c.id} />
            <Input prefix={c.id} name="name" label="Name" defaultValue={c.name} required />
            <Check name="is_active" label="Active" defaultChecked={c.is_active} />
          </ServerForm>
        ))}
        <ServerForm action={saveCoverholderAction} submit="Add coverholder" className="form-grid">
          <Input prefix="new-coverholder" name="name" label="New coverholder" required />
          <Check name="is_active" label="Active" defaultChecked />
        </ServerForm>
      </section>

      {REFERENCE_TABLES.map((table) => {
        const rows = ctx.refs[table];
        return (
          <details key={table} className="card">
            <summary>
              <strong>{TITLES[table]}</strong> <span className="muted small">({rows.length})</span>
            </summary>
            <div className="stack">
              {rows.length === 0 && <p className="notice notice-warn small">No values yet. This list is awaiting the source documents (see docs/OPEN_ITEMS.md).</p>}
              {rows.length > 0 && (
                <div className="table-wrap">
                  <table className="data">
                    <thead>
                      <tr>
                        <th scope="col">Code</th>
                        <th scope="col">Label</th>
                        <th scope="col">Order</th>
                        <th scope="col">Active</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.code}>
                          <td>{r.code}</td>
                          <td>{r.label}</td>
                          <td className="num">{r.sort_order}</td>
                          <td>{r.is_active ? "Yes" : "No"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <ServerForm action={saveReferenceAction} submit="Save value" className="form-grid">
                <input type="hidden" name="table" value={table} />
                <Input prefix={table} name="code" label="Code (new, or existing to update)" required />
                <Input prefix={table} name="label" label="Label" required />
                <Input prefix={table} name="sort_order" label="Order" type="number" defaultValue={(rows.length + 1) * 10} />
                <Check name="is_active" label="Active" defaultChecked />
              </ServerForm>
            </div>
          </details>
        );
      })}
    </div>
  );
}
