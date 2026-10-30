-- Workflow functions: one per action, called via RPC. Each checks the caller's role, checks
-- the complaint's state, makes the change and writes the audit event in one transaction.
--
-- Rules that depend on the regulatory clock (for example summary eligibility within business
-- day 3) are evaluated by the rules engine in the server action before the call; this layer
-- enforces roles, state invariants and the audit trail.

-- ---------------------------------------------------------------------------------------------
-- Internal helpers (not exposed through the API)
-- ---------------------------------------------------------------------------------------------

create or replace function app.log_event(
  p_complaint_id uuid, p_event_type text, p_description text,
  p_before jsonb default null, p_after jsonb default null
) returns void
language sql security definer set search_path = '' as $$
  insert into public.complaint_events (complaint_id, actor_id, event_type, description, before, after)
  values (p_complaint_id, app.current_user_id(), p_event_type, p_description, p_before, p_after);
$$;

create or replace function app.lock_complaint(p_id uuid) returns public.complaints
language plpgsql security definer set search_path = '' as $$
declare
  v public.complaints;
begin
  select * into v from public.complaints where id = p_id and not is_deleted for update;
  if not found then
    raise exception 'Complaint not found' using errcode = 'P0002';
  end if;
  return v;
end;
$$;

create or replace function app.check_action_date(p_date date, p_received date, p_label text) returns void
language plpgsql stable set search_path = '' as $$
begin
  if p_date is null then
    raise exception '% is required', p_label using errcode = '22023';
  end if;
  if p_date < p_received then
    raise exception '% cannot be before the received date', p_label using errcode = '22023';
  end if;
  if p_date > app.utc_today() then
    raise exception '% cannot be in the future', p_label using errcode = '22023';
  end if;
end;
$$;

create or replace function app.reject_unknown_keys(p jsonb, p_allowed text[]) returns void
language plpgsql immutable set search_path = '' as $$
declare
  v_unknown text[];
begin
  if p is null or jsonb_typeof(p) <> 'object' then
    raise exception 'Expected an object' using errcode = '22023';
  end if;
  select array_agg(k order by k) into v_unknown from jsonb_object_keys(p) k where k <> all (p_allowed);
  if v_unknown is not null then
    raise exception 'Fields not allowed: %', array_to_string(v_unknown, ', ') using errcode = '22023';
  end if;
end;
$$;

-- Retention end, matching the rules engine: 29 February rolls forward to 1 March.
create or replace function app.retention_end(p_received date, p_years integer) returns date
language sql immutable set search_path = '' as $$
  select case
    when extract(month from p_received) = 2 and extract(day from p_received) = 29
         and extract(day from p_received + make_interval(years => p_years)) = 28
      then (p_received + make_interval(years => p_years))::date + 1
    else (p_received + make_interval(years => p_years))::date
  end;
$$;

-- Fields a handler may edit after registration. Received date, insurer and lifecycle dates are
-- excluded: they move the regulatory clock and only change through workflow actions.
create or replace function app.editable_complaint_fields() returns text[]
language sql immutable as $$
  select array[
    'handler_id', 'complainant_type', 'complainant_name', 'complainant_email', 'complainant_phone',
    'address_line1', 'address_line2', 'town', 'county', 'postcode', 'country',
    'coverholder_id', 'product', 'channel', 'claim_related', 'claim_reference',
    'insurer_complaint_reference', 'eligibility', 'nature_of_complaint', 'root_cause',
    'secondary_cause', 'received_into_complaints_date', 'summary', 'findings',
    'vulnerable_customer', 'vulnerability_category'
  ];
$$;

-- ---------------------------------------------------------------------------------------------
-- Register and edit
-- ---------------------------------------------------------------------------------------------

create or replace function public.register_complaint(p jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := app.require_role('handler', 'manager');
  v public.complaints;
  v_id uuid;
begin
  perform app.reject_unknown_keys(p, app.editable_complaint_fields() || array['insurer_id', 'received_date']);
  v := jsonb_populate_record(null::public.complaints, p);

  if v.received_date is null then
    raise exception 'Received date is required' using errcode = '22023';
  end if;
  if not exists (select 1 from public.insurers i where i.id = v.insurer_id and i.is_active) then
    raise exception 'Complaint type must be an active insurer' using errcode = '22023';
  end if;

  insert into public.complaints (
    created_by, handler_id, complainant_type, complainant_name, complainant_email, complainant_phone,
    address_line1, address_line2, town, county, postcode, country,
    insurer_id, coverholder_id, product, channel, claim_related, claim_reference,
    insurer_complaint_reference, eligibility, nature_of_complaint, root_cause, secondary_cause,
    received_date, received_into_complaints_date, summary, findings,
    vulnerable_customer, vulnerability_category
  ) values (
    v_actor, coalesce(v.handler_id, v_actor), v.complainant_type, v.complainant_name,
    v.complainant_email, v.complainant_phone,
    v.address_line1, v.address_line2, v.town, v.county, v.postcode, v.country,
    v.insurer_id, v.coverholder_id, v.product, v.channel, v.claim_related, v.claim_reference,
    v.insurer_complaint_reference, v.eligibility, v.nature_of_complaint, v.root_cause, v.secondary_cause,
    v.received_date, v.received_into_complaints_date, v.summary, v.findings,
    coalesce(v.vulnerable_customer, false), v.vulnerability_category
  ) returning id into v_id;

  perform app.log_event(v_id, 'registered', 'Complaint registered');
  return v_id;
end;
$$;

create or replace function public.update_complaint_details(p_id uuid, p_changes jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_old public.complaints;
  v_new public.complaints;
  v_before jsonb;
  v_after jsonb;
begin
  perform app.require_role('handler', 'manager');
  perform app.reject_unknown_keys(p_changes, app.editable_complaint_fields());
  v_old := app.lock_complaint(p_id);
  v_new := jsonb_populate_record(v_old, p_changes);

  select jsonb_object_agg(k, to_jsonb(v_old) -> k), jsonb_object_agg(k, to_jsonb(v_new) -> k)
    into v_before, v_after
    from jsonb_object_keys(p_changes) k
   where to_jsonb(v_old) -> k is distinct from to_jsonb(v_new) -> k;

  if v_before is null then
    return;
  end if;

  update public.complaints set
    handler_id = v_new.handler_id,
    complainant_type = v_new.complainant_type,
    complainant_name = v_new.complainant_name,
    complainant_email = v_new.complainant_email,
    complainant_phone = v_new.complainant_phone,
    address_line1 = v_new.address_line1,
    address_line2 = v_new.address_line2,
    town = v_new.town,
    county = v_new.county,
    postcode = v_new.postcode,
    country = v_new.country,
    coverholder_id = v_new.coverholder_id,
    product = v_new.product,
    channel = v_new.channel,
    claim_related = v_new.claim_related,
    claim_reference = v_new.claim_reference,
    insurer_complaint_reference = v_new.insurer_complaint_reference,
    eligibility = v_new.eligibility,
    nature_of_complaint = v_new.nature_of_complaint,
    root_cause = v_new.root_cause,
    secondary_cause = v_new.secondary_cause,
    received_into_complaints_date = v_new.received_into_complaints_date,
    summary = v_new.summary,
    findings = v_new.findings,
    vulnerable_customer = v_new.vulnerable_customer,
    vulnerability_category = v_new.vulnerability_category
  where id = p_id;

  perform app.log_event(p_id, 'details_updated', 'Details updated', v_before, v_after);
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Lifecycle actions
-- ---------------------------------------------------------------------------------------------

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
  if v.status = p_status then
    return;
  end if;
  update public.complaints set status = p_status where id = p_id;
  perform app.log_event(p_id, 'status_changed', 'Status changed',
    jsonb_build_object('status', v.status), jsonb_build_object('status', p_status));
end;
$$;

create or replace function public.record_acknowledgement(p_id uuid, p_date date) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v public.complaints;
begin
  perform app.require_role('handler', 'manager');
  v := app.lock_complaint(p_id);
  if v.acknowledged_date is not null then
    raise exception 'Complaint is already acknowledged' using errcode = '22023';
  end if;
  perform app.check_action_date(p_date, v.received_date, 'Acknowledgement date');
  update public.complaints
     set acknowledged_date = p_date,
         status = case when v.status = 'new' then 'acknowledged' else v.status end
   where id = p_id;
  perform app.log_event(p_id, 'acknowledged', 'Acknowledgement sent', null,
    jsonb_build_object('acknowledged_date', p_date));
end;
$$;

create or replace function public.record_holding_response(p_id uuid, p_date date) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v public.complaints;
begin
  perform app.require_role('handler', 'manager');
  v := app.lock_complaint(p_id);
  if v.resolution_path is not null then
    raise exception 'Complaint is already resolved' using errcode = '22023';
  end if;
  perform app.check_action_date(p_date, v.received_date, 'Holding response date');
  update public.complaints set holding_response_date = p_date where id = p_id;
  perform app.log_event(p_id, 'holding_response_sent', 'Holding response sent',
    jsonb_build_object('holding_response_date', v.holding_response_date),
    jsonb_build_object('holding_response_date', p_date));
end;
$$;

create or replace function public.record_summary_resolution(p_id uuid, p_findings text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v public.complaints;
begin
  perform app.require_role('handler', 'manager');
  v := app.lock_complaint(p_id);
  if v.resolution_path is not null or v.final_response_date is not null then
    raise exception 'Complaint is already resolved' using errcode = '22023';
  end if;
  update public.complaints
     set resolution_path = 'summary_resolution',
         status = 'resolved',
         findings = coalesce(p_findings, v.findings)
   where id = p_id;
  perform app.log_event(p_id, 'summary_resolved', 'Resolved by summary resolution',
    jsonb_build_object('status', v.status),
    jsonb_build_object('status', 'resolved', 'resolution_path', 'summary_resolution'));
end;
$$;

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
         status = 'resolved',
         outcome = p_outcome,
         upheld_against = case when p_outcome = 'not_upheld' then null else p_upheld_against end,
         compensation_amount = p_compensation_amount,
         compensation_paid_by = case when coalesce(p_compensation_amount, 0) > 0 then p_compensation_paid_by end,
         findings = coalesce(p_findings, v.findings)
   where id = p_id;

  perform app.log_event(p_id, 'final_response_sent', 'Final response sent',
    jsonb_build_object('status', v.status),
    jsonb_build_object('status', 'resolved', 'final_response_date', p_date, 'outcome', p_outcome,
      'upheld_against', p_upheld_against, 'compensation_amount', p_compensation_amount,
      'compensation_paid_by', p_compensation_paid_by));
end;
$$;

create or replace function public.refer_to_lloyds(p_id uuid, p_date date, p_reference text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v public.complaints;
begin
  perform app.require_role('handler', 'manager');
  v := app.lock_complaint(p_id);
  if v.final_response_date is null then
    raise exception 'A final response must be sent before referral' using errcode = '22023';
  end if;
  if not exists (select 1 from public.insurers i where i.id = v.insurer_id and i.is_lloyds) then
    raise exception 'Only complaints for a Lloyd''s insurer can be referred to Lloyd''s' using errcode = '22023';
  end if;
  if v.lloyds_referred_date is not null then
    raise exception 'Complaint is already referred to Lloyd''s' using errcode = '22023';
  end if;
  perform app.check_action_date(p_date, v.final_response_date, 'Referral date');
  update public.complaints
     set lloyds_referred_date = p_date, status = 'referred_to_lloyds',
         fos_lloyds_reference = coalesce(p_reference, v.fos_lloyds_reference)
   where id = p_id;
  perform app.log_event(p_id, 'referred_to_lloyds', 'Referred to Lloyd''s',
    jsonb_build_object('status', v.status),
    jsonb_build_object('status', 'referred_to_lloyds', 'lloyds_referred_date', p_date));
end;
$$;

create or replace function public.refer_to_fos(p_id uuid, p_date date, p_reference text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v public.complaints;
begin
  perform app.require_role('handler', 'manager');
  v := app.lock_complaint(p_id);
  if v.final_response_date is null then
    raise exception 'A final response must be sent before referral' using errcode = '22023';
  end if;
  if v.fos_referred_date is not null then
    raise exception 'Complaint is already referred to the FOS' using errcode = '22023';
  end if;
  perform app.check_action_date(p_date, v.final_response_date, 'Referral date');
  update public.complaints
     set fos_referred_date = p_date, status = 'referred_to_fos',
         fos_lloyds_reference = coalesce(p_reference, v.fos_lloyds_reference)
   where id = p_id;
  perform app.log_event(p_id, 'referred_to_fos', 'Referred to the FOS',
    jsonb_build_object('status', v.status),
    jsonb_build_object('status', 'referred_to_fos', 'fos_referred_date', p_date));
end;
$$;

create or replace function public.record_lloyds_outcome(
  p_id uuid, p_outcome text, p_closed_date date default null,
  p_compensation numeric default null, p_actions_required boolean default false
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v public.complaints;
begin
  perform app.require_role('handler', 'manager');
  v := app.lock_complaint(p_id);
  if v.lloyds_referred_date is null then
    raise exception 'Complaint has not been referred to Lloyd''s' using errcode = '22023';
  end if;
  if p_closed_date is not null then
    perform app.check_action_date(p_closed_date, v.lloyds_referred_date, 'Lloyd''s closed date');
  end if;
  update public.complaints
     set lloyds_outcome = p_outcome, lloyds_closed_date = p_closed_date,
         compensation_awarded_after_lloyds = p_compensation,
         status = case when p_actions_required then 'actions_required_following_decision' else v.status end
   where id = p_id;
  perform app.log_event(p_id, 'lloyds_outcome_recorded', 'Lloyd''s outcome recorded',
    jsonb_build_object('status', v.status, 'lloyds_outcome', v.lloyds_outcome),
    jsonb_build_object('lloyds_outcome', p_outcome, 'lloyds_closed_date', p_closed_date,
      'compensation_awarded_after_lloyds', p_compensation, 'actions_required', p_actions_required));
end;
$$;

create or replace function public.record_fos_outcome(
  p_id uuid, p_fos_decision text, p_ombudsman_decision text default null, p_closed_date date default null,
  p_compensation numeric default null, p_actions_required boolean default false
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v public.complaints;
begin
  perform app.require_role('handler', 'manager');
  v := app.lock_complaint(p_id);
  if v.fos_referred_date is null then
    raise exception 'Complaint has not been referred to the FOS' using errcode = '22023';
  end if;
  if p_closed_date is not null then
    perform app.check_action_date(p_closed_date, v.fos_referred_date, 'FOS closed date');
  end if;
  update public.complaints
     set fos_decision = p_fos_decision, ombudsman_decision = p_ombudsman_decision,
         fos_closed_date = p_closed_date, compensation_awarded_after_fos = p_compensation,
         status = case when p_actions_required then 'actions_required_following_decision' else v.status end
   where id = p_id;
  perform app.log_event(p_id, 'fos_outcome_recorded', 'FOS outcome recorded',
    jsonb_build_object('status', v.status, 'fos_decision', v.fos_decision, 'ombudsman_decision', v.ombudsman_decision),
    jsonb_build_object('fos_decision', p_fos_decision, 'ombudsman_decision', p_ombudsman_decision,
      'fos_closed_date', p_closed_date, 'compensation_awarded_after_fos', p_compensation,
      'actions_required', p_actions_required));
end;
$$;

create or replace function public.set_compensation_status(p_id uuid, p_status text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v public.complaints;
begin
  perform app.require_role('handler', 'manager');
  if p_status is null or p_status not in ('compensation_outstanding', 'compensation_paid') then
    raise exception 'Unknown compensation status' using errcode = '22023';
  end if;
  v := app.lock_complaint(p_id);
  if v.resolution_path is null then
    raise exception 'Complaint is not yet resolved' using errcode = '22023';
  end if;
  if v.status = p_status then
    return;
  end if;
  update public.complaints set status = p_status where id = p_id;
  perform app.log_event(p_id, 'compensation_status_changed', 'Compensation status changed',
    jsonb_build_object('status', v.status), jsonb_build_object('status', p_status));
end;
$$;

-- Whether a complaint may be closed without a resolution is open item 18; allowed for now.
create or replace function public.close_complaint(p_id uuid, p_date date) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v public.complaints;
begin
  perform app.require_role('handler', 'manager');
  v := app.lock_complaint(p_id);
  if v.closed_date is not null then
    raise exception 'Complaint is already closed' using errcode = '22023';
  end if;
  perform app.check_action_date(p_date, v.received_date, 'Closed date');
  update public.complaints set closed_date = p_date, status = 'closed' where id = p_id;
  perform app.log_event(p_id, 'closed', 'Complaint closed',
    jsonb_build_object('status', v.status), jsonb_build_object('status', 'closed', 'closed_date', p_date));
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Deletion (Manager)
-- ---------------------------------------------------------------------------------------------

create or replace function public.soft_delete_complaint(p_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := app.require_role('manager');
begin
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'A reason is required' using errcode = '22023';
  end if;
  perform app.lock_complaint(p_id);
  update public.complaints
     set is_deleted = true, deleted_at = now(), deleted_by = v_actor, deletion_reason = p_reason
   where id = p_id;
  perform app.log_event(p_id, 'soft_deleted', 'Complaint deleted (soft)', null,
    jsonb_build_object('deletion_reason', p_reason));
end;
$$;

-- Permanently removes a soft deleted complaint, its audit trail and notifications, once the
-- retention period (insurer, else firm setting) has passed. Blocked when no period is set.
create or replace function public.hard_delete_complaint(p_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := app.require_role('manager');
  v public.complaints;
  v_years integer;
begin
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'A reason is required' using errcode = '22023';
  end if;
  select * into v from public.complaints where id = p_id for update;
  if not found then
    raise exception 'Complaint not found' using errcode = 'P0002';
  end if;
  if not v.is_deleted then
    raise exception 'Only a soft deleted complaint can be permanently deleted' using errcode = '22023';
  end if;
  select coalesce(i.retention_years, (select f.retention_years from public.firm_settings f))
    into v_years from public.insurers i where i.id = v.insurer_id;
  if v_years is null then
    raise exception 'No retention period is configured for this complaint type' using errcode = '22023';
  end if;
  if app.utc_today() < app.retention_end(v.received_date, v_years) then
    raise exception 'Retention period has not passed' using errcode = '42501';
  end if;

  insert into public.complaint_purge_log (complaint_reference, received_date, purged_by, reason)
  values (v.reference, v.received_date, v_actor, p_reason);
  perform set_config('app.purge', 'on', true);
  delete from public.complaints where id = p_id;
  perform set_config('app.purge', 'off', true);
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Grants: workflow functions for signed in users (each checks the role itself); helpers private.
-- ---------------------------------------------------------------------------------------------

revoke all on function
  app.log_event(uuid, text, text, jsonb, jsonb), app.lock_complaint(uuid),
  app.check_action_date(date, date, text), app.reject_unknown_keys(jsonb, text[]),
  app.retention_end(date, integer), app.editable_complaint_fields(), app.require_role(text[])
  from public;

revoke all on function
  public.register_complaint(jsonb), public.update_complaint_details(uuid, jsonb),
  public.set_complaint_status(uuid, text), public.record_acknowledgement(uuid, date),
  public.record_holding_response(uuid, date), public.record_summary_resolution(uuid, text),
  public.record_final_response(uuid, date, text, text, numeric, text, text),
  public.refer_to_lloyds(uuid, date, text), public.refer_to_fos(uuid, date, text),
  public.record_lloyds_outcome(uuid, text, date, numeric, boolean),
  public.record_fos_outcome(uuid, text, text, date, numeric, boolean),
  public.set_compensation_status(uuid, text), public.close_complaint(uuid, date),
  public.soft_delete_complaint(uuid, text), public.hard_delete_complaint(uuid, text)
  from public, anon;

grant execute on function
  public.register_complaint(jsonb), public.update_complaint_details(uuid, jsonb),
  public.set_complaint_status(uuid, text), public.record_acknowledgement(uuid, date),
  public.record_holding_response(uuid, date), public.record_summary_resolution(uuid, text),
  public.record_final_response(uuid, date, text, text, numeric, text, text),
  public.refer_to_lloyds(uuid, date, text), public.refer_to_fos(uuid, date, text),
  public.record_lloyds_outcome(uuid, text, date, numeric, boolean),
  public.record_fos_outcome(uuid, text, text, date, numeric, boolean),
  public.set_compensation_status(uuid, text), public.close_complaint(uuid, date),
  public.soft_delete_complaint(uuid, text), public.hard_delete_complaint(uuid, text)
  to authenticated;
