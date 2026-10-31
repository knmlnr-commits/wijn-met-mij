-- Security: auth adapter, row level security (default deny), grants and guard triggers.
--
-- Auth adapter: app.current_user_id() is the only place that reads the Supabase session
-- (auth.uid()). A move to Aurora Postgres replaces this function and the profiles foreign key.

create or replace function app.current_user_id() returns uuid
language sql stable as $$
  select auth.uid();
$$;

-- Role of the signed in user; null when there is no active profile (no access).
create or replace function app.current_app_role() returns text
language sql stable security definer set search_path = '' as $$
  select p.role from public.profiles p where p.id = app.current_user_id() and p.is_active;
$$;

create or replace function app.has_role(variadic roles text[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(app.current_app_role() = any (roles), false);
$$;

-- Raises when the signed in user has none of the roles; returns the user id otherwise.
create or replace function app.require_role(variadic roles text[]) returns uuid
language plpgsql stable security definer set search_path = '' as $$
begin
  if not app.has_role(variadic roles) then
    raise exception 'Not permitted' using errcode = '42501';
  end if;
  return app.current_user_id();
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Guard triggers
-- ---------------------------------------------------------------------------------------------

-- The audit trail is append only. Deletion is possible only inside hard_delete_complaint,
-- which sets the transaction local flag app.purge after the retention check.
create or replace function app.complaint_events_append_only() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' and current_setting('app.purge', true) = 'on' then
    return old;
  end if;
  raise exception 'complaint_events is append only' using errcode = '42501';
end;
$$;

create trigger complaint_events_no_update_delete
  before update or delete on public.complaint_events
  for each row execute function app.complaint_events_append_only();

create trigger complaint_events_no_truncate
  before truncate on public.complaint_events
  for each statement execute function app.complaint_events_append_only();

-- The received date anchors the regulatory clock: not in the future, never editable.
create or replace function app.complaints_guard() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    if new.received_date > app.utc_today() then
      raise exception 'Received date cannot be in the future' using errcode = '22023';
    end if;
  else
    if new.received_date is distinct from old.received_date then
      raise exception 'Received date cannot be changed after registration' using errcode = '42501';
    end if;
    if new.reference is distinct from old.reference
       or new.created_by is distinct from old.created_by
       or new.created_at is distinct from old.created_at then
      raise exception 'Reference and registration details cannot be changed' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create trigger complaints_guard
  before insert or update on public.complaints
  for each row execute function app.complaints_guard();

-- ---------------------------------------------------------------------------------------------
-- Row level security: enabled everywhere, default deny, explicit policies only.
-- ---------------------------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'firm_settings', 'insurers', 'coverholders', 'ref_product', 'ref_channel',
    'ref_complainant_type', 'ref_nature_of_complaint', 'ref_root_cause', 'ref_secondary_cause',
    'ref_vulnerability_category', 'bank_holidays', 'complaints', 'complaint_events',
    'notifications', 'complaint_purge_log'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;

  -- Settings, reference data and users: every active user reads, a Manager maintains.
  foreach t in array array[
    'profiles', 'firm_settings', 'insurers', 'coverholders', 'ref_product', 'ref_channel',
    'ref_complainant_type', 'ref_nature_of_complaint', 'ref_root_cause', 'ref_secondary_cause',
    'ref_vulnerability_category', 'bank_holidays'
  ] loop
    execute format(
      'create policy %I on public.%I for select to authenticated using ((select app.has_role(''handler'', ''manager'', ''compliance'')))',
      t || '_read', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check ((select app.has_role(''manager'')))',
      t || '_insert', t);
    execute format(
      'create policy %I on public.%I for update to authenticated using ((select app.has_role(''manager''))) with check ((select app.has_role(''manager'')))',
      t || '_update', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated using ((select app.has_role(''manager'')))',
      t || '_delete', t);
  end loop;
end;
$$;

-- Complaints: every active user reads; soft deleted records only for Manager and Compliance.
create policy complaints_read on public.complaints for select to authenticated
  using ((select app.has_role('handler', 'manager', 'compliance'))
         and (not is_deleted or (select app.has_role('manager', 'compliance'))));
create policy complaints_insert on public.complaints for insert to authenticated
  with check ((select app.has_role('handler', 'manager')));
create policy complaints_update on public.complaints for update to authenticated
  using ((select app.has_role('handler', 'manager'))) with check ((select app.has_role('handler', 'manager')));
create policy complaints_delete on public.complaints for delete to authenticated
  using ((select app.has_role('manager')));

-- Audit trail: read by all, inserted by handler and manager; no update or delete policy exists.
create policy complaint_events_read on public.complaint_events for select to authenticated
  using ((select app.has_role('handler', 'manager', 'compliance')));
create policy complaint_events_insert on public.complaint_events for insert to authenticated
  with check ((select app.has_role('handler', 'manager')));

create policy notifications_read on public.notifications for select to authenticated
  using ((select app.has_role('handler', 'manager', 'compliance')));
create policy notifications_insert on public.notifications for insert to authenticated
  with check ((select app.has_role('handler', 'manager')));
create policy notifications_update on public.notifications for update to authenticated
  using ((select app.has_role('handler', 'manager'))) with check ((select app.has_role('handler', 'manager')));

create policy complaint_purge_log_read on public.complaint_purge_log for select to authenticated
  using ((select app.has_role('manager', 'compliance')));

-- ---------------------------------------------------------------------------------------------
-- Grants. Nothing for anon. Complaints, the audit trail and notifications have no direct write
-- grant: every change goes through a workflow function that writes its audit event in the same
-- transaction, so change and audit cannot drift apart. The RLS write policies above stay as
-- defence in depth.
-- ---------------------------------------------------------------------------------------------

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;
revoke all on schema app from public, anon;

alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke execute on functions from public, anon;

grant usage on schema app to authenticated, service_role;
grant execute on function app.current_user_id(), app.current_app_role(), app.has_role(text[]) to authenticated;

grant select on all tables in schema public to authenticated;
grant insert, update, delete on
  public.profiles, public.insurers, public.coverholders, public.ref_product, public.ref_channel,
  public.ref_complainant_type, public.ref_nature_of_complaint, public.ref_root_cause,
  public.ref_secondary_cause, public.ref_vulnerability_category, public.bank_holidays
  to authenticated;
grant update on public.firm_settings to authenticated;
