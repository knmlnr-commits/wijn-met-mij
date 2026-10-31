import { ServerForm } from "@/components/ServerForm";
import { requirePageUser } from "@/lib/auth/session";
import { createUserClient } from "@/lib/db/client";
import { slaProfileFor } from "@/lib/db/profile";
import { getFirmSettings, listInsurers } from "@/lib/db/settings";
import type { SlaColumns } from "@/lib/db/types";
import { FCA_DEFAULTS, profileWarnings, RULES, type SlaKey } from "@/lib/rules";
import { saveFirmSettingsAction, saveInsurerAction } from "./actions";
import { Area, Check, Input } from "./fields";

const COLUMN: Record<SlaKey, keyof SlaColumns> = {
  ackBusinessDays: "ack_business_days",
  summaryBusinessDays: "summary_business_days",
  interimDays: "interim_days",
  finalResponseDays: "final_response_days",
  fosReferralDays: "fos_referral_days",
  amberWindowDays: "amber_window_days",
  retentionYears: "retention_years",
};

function SlaInputs({ prefix, values, fallback }: { prefix: string; values: SlaColumns | null; fallback: (key: SlaKey) => number }) {
  return (
    <>
      {RULES.map((r) => (
        <Input
          key={r.key}
          prefix={prefix}
          name={COLUMN[r.key]}
          label={`${r.label} (${r.unit})`}
          type="number"
          defaultValue={values?.[COLUMN[r.key]]}
          placeholder={`Default ${fallback(r.key)}`}
        />
      ))}
    </>
  );
}

export default async function SettingsPage() {
  await requirePageUser("manager");
  const db = await createUserClient();
  const [firm, insurers] = await Promise.all([getFirmSettings(db), listInsurers(db)]);
  const firmProfile = slaProfileFor(null, firm);

  return (
    <div className="stack">
      <section className="card stack">
        <h2>Firm settings</h2>
        <ServerForm action={saveFirmSettingsAction} submit="Save firm settings">
          <div className="form-grid">
            <Input prefix="firm" name="firm_name" label="Firm name" defaultValue={firm.firm_name} required />
            <Input prefix="firm" name="firm_short_name" label="Short name (used in upheld against)" defaultValue={firm.firm_short_name} required />
            <div className="full">
              <Check name="bank_holidays_enabled" label="Skip England and Wales bank holidays when counting business days" defaultChecked={firm.bank_holidays_enabled} />
            </div>
            <p className="small muted full">Firm wide deadlines apply to every insurer without its own value. Leave empty to use the FCA default.</p>
            <SlaInputs prefix="firm" values={firm} fallback={(k) => FCA_DEFAULTS[k]} />
            <Area prefix="firm" name="fos_wording" label="FOS referral wording (letters to non Lloyd's complainants)" defaultValue={firm.fos_wording} />
            <Area prefix="firm" name="lloyds_wording" label="Lloyd's referral wording (letters for Lloyd's insurers)" defaultValue={firm.lloyds_wording} />
            <Area prefix="firm" name="fos_contact" label="FOS contact details" defaultValue={firm.fos_contact} />
          </div>
        </ServerForm>
      </section>

      <section className="card stack">
        <h2>Insurer profiles (complaint types)</h2>
        <p className="small muted">
          Each insurer is a complaint type with its own deadlines. Empty fields use the firm setting or the FCA default. A value beyond what the FCA
          allows is saved but flagged.
        </p>
        {insurers.map((i) => {
          const warnings = profileWarnings(slaProfileFor(i, firm));
          return (
            <details key={i.id} className="card">
              <summary>
                <strong>{i.name}</strong> {i.is_lloyds && <span className="badge">Lloyd&apos;s</span>} {!i.is_active && <span className="badge">Inactive</span>}{" "}
                {warnings.length > 0 && <span className="badge badge-rose">Beyond FCA limits</span>}
              </summary>
              {warnings.length > 0 && (
                <ul className="notice notice-warn small">
                  {warnings.map((w) => (
                    <li key={w.key}>{w.message}</li>
                  ))}
                </ul>
              )}
              <ServerForm action={saveInsurerAction} submit={`Save ${i.name}`}>
                <input type="hidden" name="id" value={i.id} />
                <div className="form-grid">
                  <Input prefix={i.id} name="name" label="Name" defaultValue={i.name} required />
                  <div className="stack">
                    <Check name="is_active" label="Active (available when registering)" defaultChecked={i.is_active} />
                    <Check name="is_lloyds" label="Lloyd's (Lloyd's procedure and wording)" defaultChecked={i.is_lloyds} />
                  </div>
                  <SlaInputs prefix={i.id} values={i} fallback={(k) => firmProfile[k]} />
                </div>
              </ServerForm>
            </details>
          );
        })}
        <details className="card">
          <summary>
            <strong>Add an insurer</strong>
          </summary>
          <ServerForm action={saveInsurerAction} submit="Add insurer">
            <div className="form-grid">
              <Input prefix="new-insurer" name="name" label="Name" required />
              <div className="stack">
                <Check name="is_active" label="Active" defaultChecked />
                <Check name="is_lloyds" label="Lloyd's" />
              </div>
              <SlaInputs prefix="new-insurer" values={null} fallback={(k) => firmProfile[k]} />
            </div>
          </ServerForm>
        </details>
      </section>
    </div>
  );
}
