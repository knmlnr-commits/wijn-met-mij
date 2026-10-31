-- Customer notifications: one function per step, each audited in the same transaction.
-- Notifications have no direct write grant (see the security migration).

create or replace function public.create_notification_draft(
  p_complaint_id uuid, p_type text, p_channel text, p_content text, p_recipient_email text default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := app.require_role('handler', 'manager');
  v_id uuid;
begin
  perform app.lock_complaint(p_complaint_id);
  if p_content is null or length(trim(p_content)) = 0 then
    raise exception 'The letter has no content' using errcode = '22023';
  end if;
  insert into public.notifications (complaint_id, type, channel, rendered_content, recipient_email, status, created_by)
  values (p_complaint_id, p_type, p_channel, p_content, nullif(trim(p_recipient_email), ''), 'draft', v_actor)
  returning id into v_id;
  perform app.log_event(p_complaint_id, 'notification_created', 'Notification drafted', null,
    jsonb_build_object('notification_id', v_id, 'type', p_type, 'channel', p_channel));
  return v_id;
end;
$$;

create or replace function public.update_notification_draft(
  p_id uuid, p_content text, p_channel text, p_recipient_email text default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  n public.notifications;
begin
  perform app.require_role('handler', 'manager');
  select * into n from public.notifications where id = p_id for update;
  if not found then
    raise exception 'Notification not found' using errcode = 'P0002';
  end if;
  perform app.lock_complaint(n.complaint_id);
  if n.status <> 'draft' then
    raise exception 'Only a draft can be changed' using errcode = '22023';
  end if;
  if p_content is null or length(trim(p_content)) = 0 then
    raise exception 'The letter has no content' using errcode = '22023';
  end if;
  update public.notifications
     set rendered_content = p_content, channel = p_channel, recipient_email = nullif(trim(p_recipient_email), '')
   where id = p_id;
  perform app.log_event(n.complaint_id, 'notification_updated', 'Notification draft edited', null,
    jsonb_build_object('notification_id', p_id, 'channel', p_channel));
end;
$$;

-- Records the outcome of sending (email) or issuing (letter). The content is final from here on.
create or replace function public.mark_notification_sent(p_id uuid, p_success boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  n public.notifications;
begin
  perform app.require_role('handler', 'manager');
  select * into n from public.notifications where id = p_id for update;
  if not found then
    raise exception 'Notification not found' using errcode = 'P0002';
  end if;
  perform app.lock_complaint(n.complaint_id);
  if n.status = 'sent' then
    raise exception 'This notification has already been sent' using errcode = '22023';
  end if;
  if p_success and n.channel = 'email' and n.recipient_email is null then
    raise exception 'An email needs a recipient address' using errcode = '22023';
  end if;
  update public.notifications
     set status = case when p_success then 'sent' else 'failed' end,
         sent_at = case when p_success then now() end
   where id = p_id;
  perform app.log_event(n.complaint_id,
    case when p_success then 'notification_sent' else 'notification_failed' end,
    case when p_success then (case when n.channel = 'letter' then 'Letter issued' else 'Email sent' end) else 'Email could not be sent' end,
    null, jsonb_build_object('notification_id', p_id, 'type', n.type, 'channel', n.channel));
end;
$$;

revoke all on function
  public.create_notification_draft(uuid, text, text, text, text),
  public.update_notification_draft(uuid, text, text, text),
  public.mark_notification_sent(uuid, boolean)
  from public, anon;

grant execute on function
  public.create_notification_draft(uuid, text, text, text, text),
  public.update_notification_draft(uuid, text, text, text),
  public.mark_notification_sent(uuid, boolean)
  to authenticated;
