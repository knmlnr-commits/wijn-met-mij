-- A final response that agrees compensation leaves the complaint at Compensation outstanding
-- until the payment is recorded; without compensation it is Resolved as before.

create or replace function public.record_final_response(
  p_id uuid, p_date date, p_outcome text, p_upheld_against text default null,
  p_compensation_amount numeric default null, p_compensation_paid_by text default null,
  p_findings text default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v public.complaints;
begin
  perform app.require_role('handler', 'manager');
  v := app.lock_complaint(p_id);
  if v.resolution_path is not null or v.final_response_date is not null then
    raise exception 'Complaint is already resolved' using errcode = '22023';
  end if;
  perform app.check_action_date(p_date, v.received_date, 'Final response date');
  if p_outcome is null then
    raise exception 'Outcome is required' using errcode = '22023';
  end if;
  if p_outcome in ('upheld', 'partially_upheld') and p_upheld_against is null then
    raise exception 'Upheld against is required when the complaint is upheld' using errcode = '22023';
  end if;
  if coalesce(p_compensation_amount, 0) > 0 and p_compensation_paid_by is null then
    raise exception 'Compensation paid by is required when compensation is offered' using errcode = '22023';
  end if;

  update public.complaints
     set final_response_date = p_date,
         resolution_path = 'final_response',
         status = case when coalesce(p_compensation_amount, 0) > 0 then 'compensation_outstanding' else 'resolved' end,
         outcome = p_outcome,
         upheld_against = case when p_outcome = 'not_upheld' then null else p_upheld_against end,
         compensation_amount = p_compensation_amount,
         compensation_paid_by = case when coalesce(p_compensation_amount, 0) > 0 then p_compensation_paid_by end,
         findings = coalesce(p_findings, v.findings)
   where id = p_id;

  perform app.log_event(p_id, 'final_response_sent', 'Final response sent',
    jsonb_build_object('status', v.status),
    jsonb_build_object('status', case when coalesce(p_compensation_amount, 0) > 0 then 'compensation_outstanding' else 'resolved' end,
      'final_response_date', p_date, 'outcome', p_outcome,
      'upheld_against', p_upheld_against, 'compensation_amount', p_compensation_amount,
      'compensation_paid_by', p_compensation_paid_by));
end;
$$;

-- A resolved complaint keeps the status its steps give it; no manual change back to an open status.

create or replace function public.set_complaint_status(p_id uuid, p_status text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v public.complaints;
begin
  perform app.require_role('handler', 'manager');
  if p_status is null or p_status not in (
    'investigating', 'awaiting_information', 'referred_to_insurer', 'draft_with_insurer', 'pending_informal_action'
  ) then
    raise exception 'Status cannot be set directly' using errcode = '22023';
  end if;
  v := app.lock_complaint(p_id);
  if v.status = 'closed' then
    raise exception 'Complaint is closed' using errcode = '22023';
  end if;
  if v.resolution_path is not null then
    raise exception 'The complaint is resolved; its status follows the remaining steps' using errcode = '22023';
  end if;
  if v.status = p_status then
    return;
  end if;
  update public.complaints set status = p_status where id = p_id;
  perform app.log_event(p_id, 'status_changed', 'Status changed',
    jsonb_build_object('status', v.status), jsonb_build_object('status', p_status));
end;
$$;
