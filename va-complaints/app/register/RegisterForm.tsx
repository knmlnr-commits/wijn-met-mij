"use client";

import { useActionState, useMemo, useState } from "react";
import { CheckboxField, FormMessage, type Option, SelectField, SubmitButton, TextArea, TextField, YesNoField } from "@/components/forms";
import { registerComplaintAction } from "@/app/complaints/actions";
import { IDLE } from "@/lib/actions/state";
import { slaProfileFor } from "@/lib/db/profile";
import type { FirmSettingsRow, InsurerRow } from "@/lib/db/types";
import { ELIGIBILITY, ELIGIBILITY_LABELS } from "@/lib/domain/complaint";
import { formatDate } from "@/lib/format";
import { buildTimeline, isAfter, isIsoDate } from "@/lib/rules";

interface Props {
  today: string;
  userId: string;
  insurers: InsurerRow[];
  firm: FirmSettingsRow | null;
  holidays: string[];
  handlers: Option[];
  coverholders: Option[];
  lists: Record<"complainantType" | "product" | "channel" | "nature" | "rootCause" | "secondaryCause" | "vulnerability", Option[]>;
}

export function RegisterForm({ today, userId, insurers, firm, holidays, handlers, coverholders, lists }: Props) {
  const [result, action] = useActionState(registerComplaintAction, IDLE);
  const [insurerId, setInsurerId] = useState("");
  const [received, setReceived] = useState(today);
  const [vulnerable, setVulnerable] = useState(false);

  const preview = useMemo(() => {
    const insurer = insurers.find((i) => i.id === insurerId);
    if (!insurer || !isIsoDate(received) || isAfter(received, today)) return null;
    return { insurer, timeline: buildTimeline({ receivedDate: received, profile: slaProfileFor(insurer, firm), today, holidays }) };
  }, [insurerId, received, insurers, firm, holidays, today]);

  return (
    <form action={action} className="stack" noValidate>
      <FormMessage result={result} />

      <div className="grid-2">
        <section className="card stack">
          <h2>Complaint</h2>
          <div className="form-grid">
            <SelectField
              name="insurer_id"
              label="Complaint type"
              result={result}
              required
              options={insurers.map((i) => ({ value: i.id, label: i.name }))}
              emptyLabel="Choose the insurer"
              onChange={setInsurerId}
            />
            <div className="field">
              <label htmlFor="received_date">Received date (required)</label>
              <input id="received_date" name="received_date" type="date" required max={today} value={received} onChange={(e) => setReceived(e.target.value)} />
              {result.fieldErrors?.received_date && <span className="field-error">{result.fieldErrors.received_date}</span>}
            </div>
            <TextField name="received_into_complaints_date" label="Received into complaints" type="date" result={result} max={today} />
            <SelectField name="handler_id" label="Handler" result={result} options={handlers} defaultValue={userId} />
            <TextArea name="summary" label="Summary of the complaint" result={result} required className="full" />
          </div>
        </section>

        <section className="card stack" aria-live="polite">
          <h2>Timeline that will apply</h2>
          {preview ? (
            <>
              <p className="muted small">
                {preview.insurer.name}
                {preview.insurer.is_lloyds ? " (Lloyd's complaints procedure)" : ""}, received {formatDate(received)}.
              </p>
              <dl className="meta">
                <dt>Acknowledgement due</dt>
                <dd>{formatDate(preview.timeline.acknowledgementDue)}</dd>
                <dt>Summary resolution until</dt>
                <dd>{formatDate(preview.timeline.summaryDeadline)}</dd>
                <dt>Interim holding point</dt>
                <dd>{formatDate(preview.timeline.interimDate)}</dd>
                <dt>Final response deadline</dt>
                <dd>
                  <strong>{formatDate(preview.timeline.finalResponseDeadline)}</strong>
                </dd>
                <dt>Records kept until</dt>
                <dd>{formatDate(preview.timeline.retentionEnd)}</dd>
              </dl>
            </>
          ) : (
            <p className="muted">Choose the complaint type and received date to see the deadlines.</p>
          )}
        </section>
      </div>

      <section className="card stack">
        <h2>Complainant</h2>
        <div className="form-grid">
          <TextField name="complainant_name" label="Name" result={result} required maxLength={200} />
          <SelectField name="complainant_type" label="Complainant type" result={result} options={lists.complainantType} />
          <TextField name="complainant_email" label="Email" type="email" result={result} maxLength={320} />
          <TextField name="complainant_phone" label="Phone" type="tel" result={result} maxLength={50} />
          <TextField name="address_line1" label="Address line 1" result={result} />
          <TextField name="address_line2" label="Address line 2" result={result} />
          <TextField name="town" label="Town" result={result} />
          <TextField name="county" label="County" result={result} />
          <TextField name="postcode" label="Postcode" result={result} maxLength={20} />
          <TextField name="country" label="Country" result={result} defaultValue="United Kingdom" />
        </div>
      </section>

      <section className="card stack">
        <h2>Classification</h2>
        <div className="form-grid">
          <SelectField name="coverholder_id" label="Coverholder" result={result} options={coverholders} />
          <SelectField name="product" label="Product" result={result} options={lists.product} />
          <SelectField name="channel" label="Channel" result={result} options={lists.channel} />
          <SelectField name="eligibility" label="Eligibility" result={result} options={ELIGIBILITY.map((e) => ({ value: e, label: ELIGIBILITY_LABELS[e] }))} />
          <YesNoField name="claim_related" label="Claim related" result={result} />
          <TextField name="claim_reference" label="Claim reference" result={result} />
          <TextField name="insurer_complaint_reference" label="Insurer complaint reference" result={result} />
          <SelectField name="nature_of_complaint" label="Nature of complaint" result={result} options={lists.nature} />
          <SelectField name="root_cause" label="Root cause" result={result} options={lists.rootCause} />
          <SelectField name="secondary_cause" label="Secondary cause" result={result} options={lists.secondaryCause} />
        </div>
      </section>

      <section className="card stack">
        <h2>Vulnerability</h2>
        <CheckboxField name="vulnerable_customer" label="The customer is vulnerable" onChange={setVulnerable} />
        {vulnerable && (
          <div className="form-grid">
            <SelectField name="vulnerability_category" label="Vulnerability category" result={result} required options={lists.vulnerability} />
            {lists.vulnerability.length === 0 && (
              <p className="notice notice-warn small full">
                The vulnerability categories have not been set up yet (W&amp;C coding awaited), so a vulnerable customer cannot be saved. Note the
                vulnerability in the summary for now and tell a Manager.
              </p>
            )}
          </div>
        )}
      </section>

      <div className="button-row">
        <SubmitButton>Register complaint</SubmitButton>
      </div>
    </form>
  );
}
