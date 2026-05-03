-- House of Eve seed data — phase 1 launching customer.
-- Idempotent: safe to re-run during dev.

insert into studios (id, slug, name, default_locale, invoice_number_prefix, cancel_deadline_minutes, no_show_penalty_credits)
values ('00000000-0000-0000-0000-000000000001', 'house-of-eve', 'House of Eve', 'nl', 'HOE', 360, 1)
on conflict (id) do nothing;

-- Activities + credit cost: Reformer = 3, Barre/Yoga = 2 (per current Webflow page)
insert into activities (id, studio_id, slug, name, kind, default_credit_cost, default_duration_minutes) values
  ('00000000-0000-0000-0000-0000000a0001', '00000000-0000-0000-0000-000000000001', 'reformer', 'Reformer', 'group', 3, 50),
  ('00000000-0000-0000-0000-0000000a0002', '00000000-0000-0000-0000-000000000001', 'barre',    'Barre',    'group', 2, 50),
  ('00000000-0000-0000-0000-0000000a0003', '00000000-0000-0000-0000-000000000001', 'yoga',     'Yoga',     'group', 2, 60),
  ('00000000-0000-0000-0000-0000000a0004', '00000000-0000-0000-0000-000000000001', 'duo', 'DUO les', 'duo', 3, 50)
on conflict (id) do nothing;

-- Passes (price in cents)
insert into passes (id, studio_id, slug, name, price_eur_cents, credits, validity_days, off_peak_only, allowed_activity_ids) values
  ('00000000-0000-0000-0000-0000000b0001', '00000000-0000-0000-0000-000000000001', 'off-peak-15',    'Off Peak 15',     10500, 15, 90,  true,
    array['00000000-0000-0000-0000-0000000a0001','00000000-0000-0000-0000-0000000a0002','00000000-0000-0000-0000-0000000a0003']::uuid[]),
  ('00000000-0000-0000-0000-0000000b0002', '00000000-0000-0000-0000-000000000001', 'creditbundel-15','Creditbundel 15', 12500, 15, 90,  false,
    array['00000000-0000-0000-0000-0000000a0001','00000000-0000-0000-0000-0000000a0002','00000000-0000-0000-0000-0000000a0003']::uuid[]),
  ('00000000-0000-0000-0000-0000000b0003', '00000000-0000-0000-0000-000000000001', 'creditbundel-30','Creditbundel 30', 24000, 30, 180, false,
    array['00000000-0000-0000-0000-0000000a0001','00000000-0000-0000-0000-0000000a0002','00000000-0000-0000-0000-0000000a0003']::uuid[]),
  ('00000000-0000-0000-0000-0000000b0004', '00000000-0000-0000-0000-000000000001', 'creditbundel-60','Creditbundel 60', 43000, 60, 365, false,
    array['00000000-0000-0000-0000-0000000a0001','00000000-0000-0000-0000-0000000a0002','00000000-0000-0000-0000-0000000a0003']::uuid[]),
  ('00000000-0000-0000-0000-0000000b0005', '00000000-0000-0000-0000-000000000001', 'reformer-single','Reformer (los)',   2100,  3, 30,  false,
    array['00000000-0000-0000-0000-0000000a0001']::uuid[]),
  ('00000000-0000-0000-0000-0000000b0006', '00000000-0000-0000-0000-000000000001', 'barre-yoga-single','Barre/Yoga (los)',1400,  2, 30,  false,
    array['00000000-0000-0000-0000-0000000a0002','00000000-0000-0000-0000-0000000a0003']::uuid[])
on conflict (id) do nothing;

-- Subscriptions
insert into subscriptions (id, studio_id, slug, name, price_eur_cents, interval, credits_per_period, unlimited, credit_rollover) values
  ('00000000-0000-0000-0000-0000000c0001', '00000000-0000-0000-0000-000000000001', 'starter', 'Starter', 6900, 'month', 8,  false, false),
  ('00000000-0000-0000-0000-0000000c0002', '00000000-0000-0000-0000-000000000001', 'flex',    'Flex',    9900, 'month', 12, false, true)
on conflict (id) do nothing;

-- Map current Bsport pass/subscription IDs to ours so existing Webflow links keep redirecting after cutover.
insert into legacy_bsport_pass_map (bsport_id, studio_id, kind, pass_id, subscription_id) values
  ('702250', '00000000-0000-0000-0000-000000000001', 'pass', '00000000-0000-0000-0000-0000000b0001', null),
  ('662977', '00000000-0000-0000-0000-000000000001', 'pass', '00000000-0000-0000-0000-0000000b0002', null),
  ('662978', '00000000-0000-0000-0000-000000000001', 'pass', '00000000-0000-0000-0000-0000000b0003', null),
  ('681648', '00000000-0000-0000-0000-000000000001', 'pass', '00000000-0000-0000-0000-0000000b0004', null),
  ('723084', '00000000-0000-0000-0000-000000000001', 'pass', '00000000-0000-0000-0000-0000000b0005', null),
  ('662975', '00000000-0000-0000-0000-000000000001', 'pass', '00000000-0000-0000-0000-0000000b0006', null),
  ('29515',  '00000000-0000-0000-0000-000000000001', 'subscription', null, '00000000-0000-0000-0000-0000000c0001'),
  ('29779',  '00000000-0000-0000-0000-000000000001', 'subscription', null, '00000000-0000-0000-0000-0000000c0002')
on conflict (bsport_id) do nothing;
