"use client";

import { createContext, useActionState, useContext } from "react";
import { CheckboxField, FormMessage, SelectField, TextArea, TextField } from "@/components/forms";
import { IDLE, type ActionResult } from "@/lib/actions/state";
import type { ActionAvailability, ActionKey } from "@/lib/complaints/policy";
import { MANUAL_STATUSES, OUTCOME_LABELS, OUTCOMES, STATUS_LABELS } from "@/lib/domain/complaint";
import {
  acknowledgeAction,
  closeAction,
  compensationAction,
  finalResponseAction,
  fosOutcomeAction,
  holdingAction,
  lloydsOutcomeAction,
  referFosAction,
  referLloydsAction,
  setStatusAction,
  softDeleteAction,
  summaryAction,
} from "../actions";
import styles from "./detail.module.css";

type Action = (prev: ActionResult, form: FormData) => Promise<ActionResult>;

interface Props {
  complaintId: string;
  today: string;
  actions: ActionAvailability[];
  firmShortName: string;
  holdingRequiresFosRights: boolean;
  /** The action the next step points to; opened and marked. */
  recommended: ActionKey | null;
}

/**
 * One result for the whole panel. After a step succeeds its form leaves the list (the step is
 * no longer available), so the confirmation has to live above the forms, not inside them.
 */
const PanelContext = createContext<{ run: (action: Action, form: FormData) => void; pending: boolean } | null>(null);

function ActionForm({ complaintId, action, submit, children }: { complaintId: string; action: Action; submit: string; children?: React.ReactNode }) {
  const panel = useContext(PanelContext);
  return (
    <form action={(form) => panel?.run(action, form)} className={styles.actionForm}>
      <input type="hidden" name="complaintId" value={complaintId} />
      {children}
      <button type="submit" className="button-primary" disabled={panel?.pending}>
        {panel?.pending ? "Saving..." : submit}
      </button>
    </form>
  );
}

/** The full action set; disabled actions show why. Every action is audited server side. */
export function ActionsPanel({ complaintId, today, actions, firmShortName, holdingRequiresFosRights, recommended }: Props) {
  const none = IDLE;
  const [result, dispatch, pending] = useActionState(
    async (_prev: ActionResult, call: { action: Action; form: FormData }) => call.action(IDLE, call.form),
    IDLE,
  );
  const panel = { run: (action: Action, form: FormData) => dispatch({ action, form }), pending };
  const date = (label: string) => <TextField name="date" label={label} type="date" result={none} required defaultValue={today} max={today} />;
  const parties = [
    { value: "insurer", label: "Insurer" },
    { value: "firm", label: firmShortName },
  ];

  const forms: Partial<Record<ActionKey, React.ReactNode>> = {
    acknowledge: (
      <ActionForm complaintId={complaintId} action={acknowledgeAction} submit="Record acknowledgement">
        {date("Date sent")}
      </ActionForm>
    ),
    status: (
      <ActionForm complaintId={complaintId} action={setStatusAction} submit="Change status">
        <SelectField name="status" label="New status" result={none} required options={MANUAL_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))} emptyLabel="Choose a status" />
      </ActionForm>
    ),
    holding: (
      <ActionForm complaintId={complaintId} action={holdingAction} submit="Record holding response">
        {holdingRequiresFosRights && (
          <p className="notice notice-warn small">The final response deadline has been reached: this holding response must explain the delay and give the FOS referral rights.</p>
        )}
        {date("Date sent")}
      </ActionForm>
    ),
    summary: (
      <ActionForm complaintId={complaintId} action={summaryAction} submit="Record summary resolution">
        <TextArea name="findings" label="How it was resolved" result={none} />
      </ActionForm>
    ),
    final: (
      <ActionForm complaintId={complaintId} action={finalResponseAction} submit="Record final response">
        {date("Date sent")}
        <SelectField name="outcome" label="Outcome" result={none} required options={OUTCOMES.map((o) => ({ value: o, label: OUTCOME_LABELS[o] }))} emptyLabel="Choose the outcome" />
        <SelectField name="upheldAgainst" label="Upheld against (if upheld)" result={none} options={parties} />
        <TextField name="compensationAmount" label="Compensation (GBP)" result={none} inputMode="decimal" />
        <SelectField name="compensationPaidBy" label="Compensation paid by" result={none} options={parties} />
        <TextArea name="findings" label="Findings" result={none} />
      </ActionForm>
    ),
    referLloyds: (
      <ActionForm complaintId={complaintId} action={referLloydsAction} submit="Record referral">
        {date("Referral date")}
        <TextField name="reference" label="Lloyd's reference" result={none} />
      </ActionForm>
    ),
    referFos: (
      <ActionForm complaintId={complaintId} action={referFosAction} submit="Record referral">
        {date("Referral date")}
        <TextField name="reference" label="FOS reference" result={none} />
      </ActionForm>
    ),
    lloydsOutcome: (
      <ActionForm complaintId={complaintId} action={lloydsOutcomeAction} submit="Record outcome">
        <TextField name="decision" label="Lloyd's outcome" result={none} required />
        <TextField name="closedDate" label="Lloyd's closed date" type="date" result={none} max={today} />
        <TextField name="compensation" label="Compensation awarded (GBP)" result={none} inputMode="decimal" />
        <CheckboxField name="actionsRequired" label="Actions are required following the decision" />
      </ActionForm>
    ),
    fosOutcome: (
      <ActionForm complaintId={complaintId} action={fosOutcomeAction} submit="Record outcome">
        <TextField name="decision" label="FOS decision" result={none} required />
        <TextField name="ombudsmanDecision" label="Ombudsman decision" result={none} />
        <TextField name="closedDate" label="FOS closed date" type="date" result={none} max={today} />
        <TextField name="compensation" label="Compensation awarded (GBP)" result={none} inputMode="decimal" />
        <CheckboxField name="actionsRequired" label="Actions are required following the decision" />
      </ActionForm>
    ),
    compensation: (
      <ActionForm complaintId={complaintId} action={compensationAction} submit="Update compensation">
        <SelectField
          name="status"
          label="Compensation"
          result={none}
          required
          options={[
            { value: "compensation_outstanding", label: "Compensation outstanding" },
            { value: "compensation_paid", label: "Compensation paid" },
          ]}
          emptyLabel="Choose"
        />
      </ActionForm>
    ),
    close: (
      <ActionForm complaintId={complaintId} action={closeAction} submit="Close complaint">
        {date("Closed date")}
      </ActionForm>
    ),
    delete: (
      <ActionForm complaintId={complaintId} action={softDeleteAction} submit="Delete complaint">
        <p className="small muted">The complaint is hidden from handlers and kept until its retention period has passed.</p>
        <TextArea name="reason" label="Reason" result={none} required />
      </ActionForm>
    ),
  };

  const usable = actions.filter((a) => a.key !== "edit" && a.key !== "delete" && a.enabled);
  const blocked = actions.filter((a) => a.key !== "edit" && a.key !== "delete" && !a.enabled);
  const remove = actions.find((a) => a.key === "delete");
  // The recommended action first, so the next step is always at the top.
  usable.sort((a, b) => Number(b.key === recommended) - Number(a.key === recommended));

  return (
    <section className={styles.actions} aria-label="Actions" id="actions">
      <h2>Actions</h2>
      {result.message && (
        <div className={styles.outcome}>
          <FormMessage result={result} />
          {result.fieldErrors && (
            <ul className="field-error">
              {Object.values(result.fieldErrors).map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          )}
          {result.ok && result.message.includes("letter draft") && (
            <a href="#notifications" className="button-secondary">
              Review the letter
            </a>
          )}
        </div>
      )}
      <PanelContext.Provider value={panel}>
      {usable.length === 0 && <p className="muted small">No actions are available on this complaint right now.</p>}
      <ul className={styles.actionList}>
        {usable.map((a) => (
          <li key={a.key}>
            <details className={`${styles.action} ${a.key === recommended ? styles.recommended : ""}`} open={a.key === recommended}>
              <summary>
                {a.label}
                {a.key === recommended && <span className={styles.nextBadge}>Next step</span>}
              </summary>
              {forms[a.key]}
            </details>
          </li>
        ))}
      </ul>
      {blocked.length > 0 && (
        <details className={styles.blocked}>
          <summary>Not available yet ({blocked.length})</summary>
          <ul className={styles.actionList}>
            {blocked.map((a) => (
              <li key={a.key} className={`${styles.action} ${styles.disabled}`}>
                <span className={styles.actionLabel}>{a.label}</span>
                <span className={styles.reason}>{a.reason}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
      {remove?.enabled && (
        <details className={styles.blocked}>
          <summary>Delete this complaint</summary>
          {forms.delete}
        </details>
      )}
      </PanelContext.Provider>
    </section>
  );
}
