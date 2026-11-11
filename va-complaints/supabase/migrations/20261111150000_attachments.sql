-- Attachments to customer notifications. A file belongs to one letter or email; it can be added
-- or removed while that notification is a draft, and is fixed once the notification is sent.
-- The content lives in the database so it falls under the same access rules, audit trail and
-- retention (deleted with the complaint). TODO(CONFIRM): object storage and malware scanning
-- before real use, see docs/OPEN_ITEMS.md item 41.

create table public.notification_attachments (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications (id) on delete cascade,
  complaint_id uuid not null references public.complaints (id) on delete cascade,
  file_name text not null check (length(file_name) between 1 and 200),
  content_type text not null,
  size_bytes integer not null check (size_bytes > 0),
  content bytea not null,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id)
);

create index notification_attachments_notification_idx on public.notification_attachments (notification_id, created_at);

alter table public.notification_attachments enable row level security;

create policy notification_attachments_read on public.notification_attachments for select to authenticated
  using ((select app.has_role('handler', 'manager', 'compliance')));

-- No write grant, and the file content itself is not selectable: it is read only through
-- get_notification_attachment, so a list of attachments never carries the files.
revoke all on public.notification_attachments from anon, authenticated;
grant select (id, notification_id, complaint_id, file_name, content_type, size_bytes, created_at, created_by)
  on public.notification_attachments to authenticated;

alter table public.complaint_events drop constraint complaint_events_event_type_check;
alter table public.complaint_events add constraint complaint_events_event_type_check check (event_type in (
  'registered', 'details_updated', 'status_changed', 'acknowledged', 'holding_response_sent',
  'summary_resolved', 'final_response_sent', 'referred_to_lloyds', 'referred_to_fos',
  'lloyds_outcome_recorded', 'fos_outcome_recorded', 'compensation_status_changed', 'closed',
  'soft_deleted', 'notification_created', 'notification_updated', 'notification_sent',
  'notification_failed', 'attachment_added', 'attachment_removed'
));

-- Limits, in one place for the database. The application checks the same values first
-- (lib/attachments/rules.ts; a test keeps the two in step).
create or replace function app.attachment_max_bytes() returns integer language sql immutable set search_path = '' as $$ select 3145728 $$;
create or replace function app.attachment_max_per_notification() returns integer language sql immutable set search_path = '' as $$ select 5 $$;
create or replace function app.attachment_content_types() returns text[] language sql immutable set search_path = '' as $$
  select array[
    'application/pdf', 'image/png', 'image/jpeg',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
$$;

create or replace function public.add_notification_attachment(
  p_notification_id uuid, p_file_name text, p_content_type text, p_content_base64 text
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := app.require_role('handler', 'manager');
  n public.notifications;
  v_content bytea;
  v_name text := trim(p_file_name);
  v_id uuid;
begin
  select * into n from public.notifications where id = p_notification_id for update;
  if not found then
    raise exception 'Notification not found' using errcode = 'P0002';
  end if;
  perform app.lock_complaint(n.complaint_id);
  if n.status = 'sent' then
    raise exception 'Attachments cannot be added once the notification is sent' using errcode = '22023';
  end if;
  if v_name is null or length(v_name) = 0 or length(v_name) > 200 or v_name ~ '[/\\[:cntrl:]]' then
    raise exception 'The file name is not valid' using errcode = '22023';
  end if;
  if not (p_content_type = any (app.attachment_content_types())) then
    raise exception 'This type of file cannot be attached' using errcode = '22023';
  end if;
  v_content := decode(p_content_base64, 'base64');
  if length(v_content) = 0 then
    raise exception 'The file is empty' using errcode = '22023';
  end if;
  if length(v_content) > app.attachment_max_bytes() then
    raise exception 'The file is too large' using errcode = '22023';
  end if;
  if (select count(*) from public.notification_attachments where notification_id = p_notification_id)
     >= app.attachment_max_per_notification() then
    raise exception 'This notification already has the maximum number of attachments' using errcode = '22023';
  end if;
  insert into public.notification_attachments (notification_id, complaint_id, file_name, content_type, size_bytes, content, created_by)
  values (p_notification_id, n.complaint_id, v_name, p_content_type, length(v_content), v_content, v_actor)
  returning id into v_id;
  perform app.log_event(n.complaint_id, 'attachment_added', 'Attachment added', null,
    jsonb_build_object('notification_id', p_notification_id, 'attachment_id', v_id, 'type', n.type,
      'file_name', v_name, 'size_bytes', length(v_content)));
  return v_id;
end;
$$;

create or replace function public.remove_notification_attachment(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  a public.notification_attachments;
  n public.notifications;
begin
  perform app.require_role('handler', 'manager');
  select * into a from public.notification_attachments where id = p_id;
  if not found then
    raise exception 'Attachment not found' using errcode = 'P0002';
  end if;
  select * into n from public.notifications where id = a.notification_id for update;
  perform app.lock_complaint(n.complaint_id);
  if n.status = 'sent' then
    raise exception 'Attachments cannot be removed once the notification is sent' using errcode = '22023';
  end if;
  delete from public.notification_attachments where id = p_id;
  perform app.log_event(n.complaint_id, 'attachment_removed', 'Attachment removed', null,
    jsonb_build_object('notification_id', n.id, 'attachment_id', p_id, 'type', n.type,
      'file_name', a.file_name, 'size_bytes', a.size_bytes));
end;
$$;

-- The file itself, for a download or for sending. Reading roles only; a deleted complaint's
-- files follow the complaint (Manager and Compliance).
create or replace function public.get_notification_attachment(p_id uuid)
returns table (notification_id uuid, complaint_id uuid, file_name text, content_type text, content_base64 text)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform app.require_role('handler', 'manager', 'compliance');
  return query
    select a.notification_id, a.complaint_id, a.file_name, a.content_type, encode(a.content, 'base64')
      from public.notification_attachments a
      join public.complaints c on c.id = a.complaint_id
     where a.id = p_id
       and (not c.is_deleted or app.has_role('manager', 'compliance'));
end;
$$;

revoke all on function
  public.add_notification_attachment(uuid, text, text, text),
  public.remove_notification_attachment(uuid),
  public.get_notification_attachment(uuid)
  from public, anon;

grant execute on function
  public.add_notification_attachment(uuid, text, text, text),
  public.remove_notification_attachment(uuid),
  public.get_notification_attachment(uuid)
  to authenticated;
