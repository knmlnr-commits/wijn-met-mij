"use client";

import { useActionState, useState } from "react";
import { CheckboxField, FormMessage, type Option, SelectField, SubmitButton, TextArea, TextField, YesNoField } from "@/components/forms";
import { IDLE } from "@/lib/actions/state";
import type { ComplaintRow } from "@/lib/db/types";
import { ELIGIBILITY, ELIGIBILITY_LABELS } from "@/lib/domain/complaint";
import { updateDetailsAction } from "../actions";

interface Props {
  complaint: ComplaintRow;
  today: string;
  handlers: Option[];
  coverholders: Option[];
  lists: Record<"complainantType" | "product" | "channel" | "nature" | "rootCause" | "secondaryCause" | "vulnerability", Option[]>;
}

/** Inline edit of descriptive fields. The received date and complaint type are locked. */
export function EditDetails({ complaint: c, today, handlers, coverholders, lists }: Props) {
  const [result, action] = useActionState(updateDetailsAction, IDLE);
  const [vulnerable, setVulnerable] = useState(c.vulnerable_customer);

  return (
    <form action={action} className="stack">
      <input type="hidden" name="complaintId" value={c.id} />
      <p className="small muted">The received date and complaint type cannot be changed: they set the regulatory clock. Every change is recorded in the audit trail.</p>
      <div className="form-grid">
        <TextField name="complainant_name" label="Name" result={result} required defaultValue={c.complainant_name} />
        <SelectField name="complainant_type" label="Complainant type" result={result} options={lists.complainantType} defaultValue={c.complainant_type} />
        <TextField name="complainant_email" label="Email" type="email" result={result} defaultValue={c.complainant_email} />
        <TextField name="complainant_phone" label="Phone" type="tel" result={result} defaultValue={c.complainant_phone} />
        <TextField name="address_line1" label="Address line 1" result={result} defaultValue={c.address_line1} />
        <TextField name="address_line2" label="Address line 2" result={result} defaultValue={c.address_line2} />
        <TextField name="town" label="Town" result={result} defaultValue={c.town} />
        <TextField name="county" label="County" result={result} defaultValue={c.county} />
        <TextField name="postcode" label="Postcode" result={result} defaultValue={c.postcode} />
        <TextField name="country" label="Country" result={result} defaultValue={c.country} />
        <SelectField name="handler_id" label="Handler" result={result} options={handlers} defaultValue={c.handler_id} />
        <SelectField name="coverholder_id" label="Coverholder" result={result} options={coverholders} defaultValue={c.coverholder_id} />
        <SelectField name="product" label="Product" result={result} options={lists.product} defaultValue={c.product} />
        <SelectField name="channel" label="Channel" result={result} options={lists.channel} defaultValue={c.channel} />
        <SelectField name="eligibility" label="Eligibility" result={result} options={ELIGIBILITY.map((e) => ({ value: e, label: ELIGIBILITY_LABELS[e] }))} defaultValue={c.eligibility} />
        <YesNoField name="claim_related" label="Claim related" result={result} defaultValue={c.claim_related} />
        <TextField name="claim_reference" label="Claim reference" result={result} defaultValue={c.claim_reference} />
        <TextField name="insurer_complaint_reference" label="Insurer complaint reference" result={result} defaultValue={c.insurer_complaint_reference} />
        <SelectField name="nature_of_complaint" label="Nature of complaint" result={result} options={lists.nature} defaultValue={c.nature_of_complaint} />
        <SelectField name="root_cause" label="Root cause" result={result} options={lists.rootCause} defaultValue={c.root_cause} />
        <SelectField name="secondary_cause" label="Secondary cause" result={result} options={lists.secondaryCause} defaultValue={c.secondary_cause} />
        <TextField name="received_into_complaints_date" label="Received into complaints" type="date" result={result} max={today} defaultValue={c.received_into_complaints_date} />
        <TextArea name="summary" label="Summary" result={result} required className="full" defaultValue={c.summary} />
        <TextArea name="findings" label="Findings" result={result} className="full" defaultValue={c.findings} />
        <div className="full">
          <CheckboxField name="vulnerable_customer" label="The customer is vulnerable" defaultChecked={c.vulnerable_customer} onChange={setVulnerable} />
        </div>
        {vulnerable && <SelectField name="vulnerability_category" label="Vulnerability category" result={result} required options={lists.vulnerability} defaultValue={c.vulnerability_category} />}
      </div>
      <FormMessage result={result} />
      <div className="button-row">
        <SubmitButton>Save changes</SubmitButton>
      </div>
    </form>
  );
}
