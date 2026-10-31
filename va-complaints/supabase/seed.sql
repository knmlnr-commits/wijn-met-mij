-- Reference seed, applied by `supabase db reset`. Only values from /docs or the build prompt.
-- Demo users, synthetic complaints and bank holidays are loaded by the scripts in /scripts.

-- TODO(CONFIRM): legal entity name and short name used in letters and "upheld against".
-- FOS and Lloyd's wording (spec section 4) and FOS contact details are not seeded until the
-- specification is supplied (docs/OPEN_ITEMS.md items 9 and 14).
insert into public.firm_settings (id, firm_name, firm_short_name, bank_holidays_enabled)
values (true, 'Van Ameyde', 'Van Ameyde', true)
on conflict (id) do nothing;

-- Demo SLA profiles from spec section 5. The amber window is not given, so the engine default applies.
insert into public.insurers
  (name, is_lloyds, ack_business_days, summary_business_days, interim_days, final_response_days, fos_referral_days, retention_years)
values
  ('Lloyd''s', true, 1, 3, 28, 56, 182, 3),
  ('Allianz', false, 1, 3, 28, 40, 182, 3),
  ('AXA', false, 2, 3, 28, 56, 182, 6),
  ('Aviva', false, 1, 3, 28, 28, 182, 3),
  ('Zurich', false, 1, 3, 28, 56, 182, 3)
on conflict (name) do nothing;

-- Complainant types from the build prompt. TODO(CONFIRM): labels for LH and MA (open item 2).
insert into public.ref_complainant_type (code, label, sort_order)
values
  ('BROKER', 'Broker', 10),
  ('PH', 'PH', 20),
  ('LH', 'LH', 30),
  ('MA', 'MA', 40),
  ('TENANT', 'Tenant', 50),
  ('ASSESSOR', 'Assessor', 60),
  ('SOLICITOR', 'Solicitor', 70),
  ('CLAIMANT', 'Claimant', 80),
  ('OTHER', 'Other', 90)
on conflict (code) do nothing;

-- Left empty until supplied (docs/OPEN_ITEMS.md):
--   ref_product, ref_channel (spec section 3), ref_nature_of_complaint, ref_root_cause,
--   ref_secondary_cause (Complaint_Field_Requirements.xlsx), ref_vulnerability_category (W&C coding),
--   coverholders (no list supplied).
