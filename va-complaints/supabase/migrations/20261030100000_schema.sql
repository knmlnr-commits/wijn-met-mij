-- Van Ameyde Complaints Management: core schema.
-- Portable Postgres. Supabase specific: profiles.id references auth.users (the auth adapter).
-- Regulatory numbers are not stored as defaults here; they live in the rules engine (lib/rules).

create schema if not exists app;

create or replace function app.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Today in UTC; business dates are compared against this, never against the server time zone.
create or replace function app.utc_today() returns date
language sql stable as $$
  select (now() at time zone 'utc')::date;
$$;

-- ---------------------------------------------------------------------------------------------
-- Users and settings
-- ---------------------------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (length(trim(display_name)) > 0),
  email text not null unique,
  role text not null check (role in ('handler', 'manager', 'compliance')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Single row. SLA columns are optional firm wide overrides; null means the rules engine default.
create table public.firm_settings (
  id boolean primary key default true check (id),
  firm_name text not null check (length(trim(firm_name)) > 0),
  firm_short_name text not null check (length(trim(firm_short_name)) > 0),
  bank_holidays_enabled boolean not null default true,
  ack_business_days integer check (ack_business_days >= 1),
  summary_business_days integer check (summary_business_days >= 1),
  interim_days integer check (interim_days >= 1),
  final_response_days integer check (final_response_days >= 1),
  fos_referral_days integer check (fos_referral_days >= 1),
  amber_window_days integer check (amber_window_days >= 1),
  retention_years integer check (retention_years >= 1),
  fos_wording text,
  lloyds_wording text,
  fos_contact text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The insurer is the complaint type and drives the timeline. SLA columns override the firm
-- settings, which override the rules engine defaults.
create table public.insurers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) > 0),
  is_active boolean not null default true,
  is_lloyds boolean not null default false,
  ack_business_days integer check (ack_business_days >= 1),
  summary_business_days integer check (summary_business_days >= 1),
  interim_days integer check (interim_days >= 1),
  final_response_days integer check (final_response_days >= 1),
  fos_referral_days integer check (fos_referral_days >= 1),
  amber_window_days integer check (amber_window_days >= 1),
  retention_years integer check (retention_years >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.coverholders (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------------------------
-- Reference tables, maintained by a Manager
-- ---------------------------------------------------------------------------------------------

create table public.ref_product (
  code text primary key check (length(trim(code)) > 0),
  label text not null check (length(trim(label)) > 0),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ref_channel (like public.ref_product including all);
create table public.ref_complainant_type (like public.ref_product including all);
create table public.ref_nature_of_complaint (like public.ref_product including all);
create table public.ref_root_cause (like public.ref_product including all);
create table public.ref_secondary_cause (like public.ref_product including all);
create table public.ref_vulnerability_category (like public.ref_product including all);

create table public.bank_holidays (
  date date not null,
  name text not null,
  region text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (region, date)
);

-- ---------------------------------------------------------------------------------------------
-- Complaints
-- ---------------------------------------------------------------------------------------------

create sequence public.complaint_reference_seq;

create or replace function app.next_complaint_reference() returns text
language sql volatile as $$
  select 'C-' || lpad(n::text, greatest(6, length(n::text)), '0')
  from (select nextval('public.complaint_reference_seq') as n) s;
$$;

create table public.complaints (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique default app.next_complaint_reference() check (reference ~ '^C-[0-9]{6,}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles (id),
  handler_id uuid references public.profiles (id),

  -- Complainant
  complainant_type text references public.ref_complainant_type (code) on update cascade,
  complainant_name text not null check (length(trim(complainant_name)) > 0),
  complainant_email text,
  complainant_phone text,
  address_line1 text,
  address_line2 text,
  town text,
  county text,
  postcode text,
  country text,

  -- Classification
  insurer_id uuid not null references public.insurers (id),
  coverholder_id uuid references public.coverholders (id),
  product text references public.ref_product (code) on update cascade,
  channel text references public.ref_channel (code) on update cascade,
  claim_related boolean,
  claim_reference text,
  insurer_complaint_reference text,
  eligibility text check (eligibility in ('eligible', 'non_eligible')),

  -- Taxonomy
  nature_of_complaint text references public.ref_nature_of_complaint (code) on update cascade,
  root_cause text references public.ref_root_cause (code) on update cascade,
  secondary_cause text references public.ref_secondary_cause (code) on update cascade,

  -- Dates
  received_date date not null,
  received_into_complaints_date date,
  acknowledged_date date,
  holding_response_date date,
  final_response_date date,
  fos_referred_date date,
  lloyds_referred_date date,
  fos_closed_date date,
  lloyds_closed_date date,
  closed_date date,

  summary text not null check (length(trim(summary)) > 0),
  findings text,

  status text not null default 'new' check (status in (
    'new', 'pending_informal_action', 'referred_to_insurer', 'acknowledged', 'investigating',
    'awaiting_information', 'draft_with_insurer', 'resolved', 'compensation_outstanding',
    'compensation_paid', 'referred_to_lloyds', 'referred_to_fos',
    'actions_required_following_decision', 'closed'
  )),

  -- Resolution
  resolution_path text check (resolution_path in ('summary_resolution', 'final_response')),
  outcome text check (outcome in ('upheld', 'partially_upheld', 'not_upheld')),
  upheld_against text check (upheld_against in ('insurer', 'firm')),
  compensation_amount numeric(12, 2) check (compensation_amount >= 0),
  compensation_paid_by text check (compensation_paid_by in ('insurer', 'firm')),

  -- Escalation
  fos_lloyds_reference text,
  lloyds_outcome text,
  fos_decision text,
  ombudsman_decision text,
  compensation_awarded_after_fos numeric(12, 2) check (compensation_awarded_after_fos >= 0),
  compensation_awarded_after_lloyds numeric(12, 2) check (compensation_awarded_after_lloyds >= 0),

  -- Vulnerability
  vulnerable_customer boolean not null default false,
  vulnerability_category text references public.ref_vulnerability_category (code) on update cascade,

  -- Soft delete
  is_deleted boolean not null default false,
  deleted_at timestamptz,
  deleted_by uuid references public.profiles (id),
  deletion_reason text,

  constraint vulnerability_category_required check (not vulnerable_customer or vulnerability_category is not null),
  constraint soft_delete_consistent check (
    (is_deleted and deleted_at is not null and deletion_reason is not null)
    or (not is_deleted and deleted_at is null and deleted_by is null and deletion_reason is null)
  ),
  constraint dates_not_before_receipt check (
    coalesce(received_into_complaints_date, received_date) >= received_date
    and coalesce(acknowledged_date, received_date) >= received_date
    and coalesce(holding_response_date, received_date) >= received_date
    and coalesce(final_response_date, received_date) >= received_date
    and coalesce(fos_referred_date, received_date) >= received_date
    and coalesce(lloyds_referred_date, received_date) >= received_date
    and coalesce(fos_closed_date, received_date) >= received_date
    and coalesce(lloyds_closed_date, received_date) >= received_date
    and coalesce(closed_date, received_date) >= received_date
  )
);

create index complaints_status_idx on public.complaints (status) where not is_deleted;
create index complaints_insurer_idx on public.complaints (insurer_id);
create index complaints_handler_idx on public.complaints (handler_id);
create index complaints_received_idx on public.complaints (received_date);

-- Append only audit trail. No updated_at: rows never change.
create table public.complaint_events (
  id uuid primary key default gen_random_uuid(),
  complaint_id uuid not null references public.complaints (id) on delete cascade,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  actor_id uuid references public.profiles (id),
  event_type text not null check (event_type in (
    'registered', 'details_updated', 'status_changed', 'acknowledged', 'holding_response_sent',
    'summary_resolved', 'final_response_sent', 'referred_to_lloyds', 'referred_to_fos',
    'lloyds_outcome_recorded', 'fos_outcome_recorded', 'compensation_status_changed', 'closed',
    'soft_deleted', 'notification_created', 'notification_updated', 'notification_sent',
    'notification_failed'
  )),
  description text not null,
  before jsonb,
  after jsonb
);

create index complaint_events_complaint_idx on public.complaint_events (complaint_id, occurred_at);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  complaint_id uuid not null references public.complaints (id) on delete cascade,
  type text not null check (type in ('acknowledgement', 'holding', 'summary_resolution', 'final_response')),
  channel text not null check (channel in ('email', 'letter')),
  rendered_content text not null,
  recipient_email text,
  status text not null default 'draft' check (status in ('draft', 'sent', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz,
  created_by uuid references public.profiles (id),
  constraint sent_has_timestamp check (status <> 'sent' or sent_at is not null),
  constraint email_has_recipient check (channel <> 'email' or status = 'draft' or recipient_email is not null)
);

create index notifications_complaint_idx on public.notifications (complaint_id, created_at);

-- Record of hard deletions after retention. Holds no personal data.
create table public.complaint_purge_log (
  id uuid primary key default gen_random_uuid(),
  complaint_reference text not null,
  received_date date not null,
  purged_at timestamptz not null default now(),
  purged_by uuid references public.profiles (id),
  reason text not null
);

-- updated_at triggers
do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'firm_settings', 'insurers', 'coverholders', 'ref_product', 'ref_channel',
    'ref_complainant_type', 'ref_nature_of_complaint', 'ref_root_cause', 'ref_secondary_cause',
    'ref_vulnerability_category', 'bank_holidays', 'complaints', 'notifications'
  ] loop
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function app.set_updated_at()',
      t
    );
  end loop;
end;
$$;
