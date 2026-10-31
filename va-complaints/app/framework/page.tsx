import type { Metadata } from "next";
import { requirePageUser } from "@/lib/auth/session";
import { createUserClient } from "@/lib/db/client";
import { slaProfileFor } from "@/lib/db/profile";
import { getFirmSettings, listBankHolidays, listInsurers } from "@/lib/db/settings";
import { formatDate } from "@/lib/format";
import { BANK_HOLIDAY_REGION, FCA_DEFAULTS, profileWarnings, RULES } from "@/lib/rules";

export const metadata: Metadata = { title: "Framework | Van Ameyde Complaints Management" };

/** Read only summary of the rules, generated from the rules engine constants and the current profiles. */
export default async function FrameworkPage() {
  await requirePageUser();
  const db = await createUserClient();
  const [firm, insurers, holidays] = await Promise.all([getFirmSettings(db), listInsurers(db), listBankHolidays(db)]);
  const ew = holidays.filter((h) => h.region === BANK_HOLIDAY_REGION);

  return (
    <div className="stack">
      <div className="page-header">
        <h1>Framework</h1>
      </div>
      <p className="muted">
        The rules below are what the application enforces. They come straight from the rules engine and the insurer profiles in Settings, so this
        page is always current.
      </p>

      <section className="card stack">
        <h2>FCA DISP defaults</h2>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th scope="col">Rule</th>
                <th scope="col">Default</th>
                <th scope="col">Basis</th>
              </tr>
            </thead>
            <tbody>
              {RULES.map((r) => (
                <tr key={r.key}>
                  <td>{r.label}</td>
                  <td>
                    {FCA_DEFAULTS[r.key]} {r.unit}
                  </td>
                  <td className="wrap">{r.basis}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="small muted">
          <li>Red: acknowledgement overdue; final response deadline passed without a final response; or final response sent after the deadline.</li>
          <li>Amber: inside the amber window before the final response deadline; or awaiting acknowledgement but still inside target.</li>
          <li>Green: on track, resolved within the deadline, or resolved by summary resolution.</li>
          <li>Flagged but not a breach: week 4 reached without a holding response; summary route expired after business day 3.</li>
        </ul>
      </section>

      <section className="card stack">
        <h2>Profiles per complaint type</h2>
        <p className="small muted">An insurer value applies first, then the firm setting, then the FCA default.</p>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th scope="col">Complaint type</th>
                {RULES.map((r) => (
                  <th key={r.key} scope="col">
                    {r.label}
                  </th>
                ))}
                <th scope="col">Route</th>
              </tr>
            </thead>
            <tbody>
              {insurers.map((i) => {
                const profile = slaProfileFor(i, firm);
                const warnings = profileWarnings(profile);
                return (
                  <tr key={i.id}>
                    <td>
                      {i.name}
                      {!i.is_active && <span className="badge"> Inactive</span>}
                      {warnings.length > 0 && <div className="field-error">{warnings.map((w) => w.message).join(" ")}</div>}
                    </td>
                    {RULES.map((r) => (
                      <td key={r.key} className="num">
                        {profile[r.key]}
                      </td>
                    ))}
                    <td>{i.is_lloyds ? "Lloyd's, then FOS" : "FOS"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card stack">
        <h2>Business days</h2>
        <p>
          Business days skip weekends{firm.bank_holidays_enabled ? " and England and Wales bank holidays" : ""}.{" "}
          {firm.bank_holidays_enabled
            ? ew.length > 0
              ? `${ew.length} bank holidays are loaded, from ${formatDate(ew[0].date)} to ${formatDate(ew[ew.length - 1].date)}. Dates outside this range count as normal business days.`
              : "No bank holidays are loaded yet; a Manager can load them in Settings."
            : "Bank holiday handling is switched off in Settings."}
        </p>
      </section>
    </div>
  );
}
