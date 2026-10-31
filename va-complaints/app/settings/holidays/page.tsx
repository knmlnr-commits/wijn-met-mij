import Link from "next/link";
import { ServerForm } from "@/components/ServerForm";
import { requirePageUser } from "@/lib/auth/session";
import { createUserClient } from "@/lib/db/client";
import { getFirmSettings, listBankHolidays } from "@/lib/db/settings";
import { formatDate } from "@/lib/format";
import { BANK_HOLIDAY_REGION, todayUtc } from "@/lib/rules";
import { addBankHolidayAction, refreshBankHolidaysAction, removeBankHolidayAction } from "../actions";
import { Input } from "../fields";

export default async function HolidaysPage() {
  await requirePageUser("manager");
  const db = await createUserClient();
  const [firm, holidays] = await Promise.all([getFirmSettings(db), listBankHolidays(db)]);
  const ew = holidays.filter((h) => h.region === BANK_HOLIDAY_REGION);
  const today = todayUtc();
  const upcoming = ew.filter((h) => h.date >= `${today.slice(0, 4)}-01-01`);

  return (
    <div className="stack">
      <section className="card stack">
        <h2>England and Wales bank holidays</h2>
        <p>
          Holiday handling is <strong>{firm.bank_holidays_enabled ? "on" : "off"}</strong>; change it in <Link href="/settings">firm settings</Link>.{" "}
          {ew.length > 0 ? `${ew.length} dates loaded, from ${formatDate(ew[0].date)} to ${formatDate(ew[ew.length - 1].date)}.` : "No dates loaded yet."}
        </p>
        <ServerForm action={refreshBankHolidaysAction} submit="Load the latest dates from gov.uk" variant="secondary" />
      </section>

      <section className="card stack">
        <h2>Add a date</h2>
        <p className="small muted">For a one off holiday announced before gov.uk publishes it.</p>
        <ServerForm action={addBankHolidayAction} submit="Add date" className="form-grid">
          <Input prefix="holiday" name="date" label="Date" type="date" required />
          <Input prefix="holiday" name="name" label="Name" required />
        </ServerForm>
      </section>

      <section className="card stack">
        <h2>This year and later</h2>
        {upcoming.length === 0 ? (
          <p className="muted">None loaded.</p>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Name</th>
                  <th scope="col">
                    <span className="muted">Remove</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {upcoming.map((h) => (
                  <tr key={h.date}>
                    <td>{formatDate(h.date)}</td>
                    <td>{h.name}</td>
                    <td>
                      <ServerForm action={removeBankHolidayAction} submit="Remove" variant="secondary" className="">
                        <input type="hidden" name="date" value={h.date} />
                      </ServerForm>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
