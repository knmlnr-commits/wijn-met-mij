-- Pin the search path of the helper and trigger functions (Supabase security advisor 0011).
-- Every reference in them is already schema qualified, so behaviour does not change.

alter function app.set_updated_at() set search_path = '';
alter function app.utc_today() set search_path = '';
alter function app.next_complaint_reference() set search_path = '';
alter function app.current_user_id() set search_path = '';
alter function app.complaint_events_append_only() set search_path = '';
alter function app.complaints_guard() set search_path = '';
alter function app.editable_complaint_fields() set search_path = '';
