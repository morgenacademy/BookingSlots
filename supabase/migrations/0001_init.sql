-- BookingSlots v1 — initial schema
-- Single-tenant per studio in v1; `studio_id` everywhere so multi-tenant is a flag flip later.
-- All tables RLS-enabled. Helper predicates pulled from `auth.uid()`.

create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- ─────────────────────────────────────────────────────────────────────────────
-- studios + admins
-- ─────────────────────────────────────────────────────────────────────────────
create table studios (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  default_locale text not null default 'nl',
  vat_number text,
  invoice_number_prefix text not null default 'INV',
  invoice_year_counter int not null default 0,
  invoice_year int not null default extract(year from now()),
  cancel_deadline_minutes int not null default 360,
  no_show_penalty_credits int not null default 1,
  created_at timestamptz not null default now()
);

create table studio_admins (
  studio_id uuid not null references studios(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','manager','staff')),
  created_at timestamptz not null default now(),
  primary key (studio_id, user_id)
);

create or replace function is_studio_admin(p_studio uuid) returns boolean
language sql stable security definer as $$
  select exists (
    select 1 from studio_admins
    where studio_id = p_studio and user_id = auth.uid()
  );
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- users (profile extends auth.users)
-- ─────────────────────────────────────────────────────────────────────────────
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  studio_id uuid not null references studios(id),
  first_name text,
  last_name text,
  email citext not null,
  phone text,
  gender text check (gender in ('f','m','x')),
  birthday date,
  locale text not null default 'nl',
  member_since date not null default current_date,
  terms_accepted_at timestamptz,
  general_terms_accepted_at timestamptz,
  wallet_eur_cents int not null default 0,
  mollie_customer_id text,
  created_at timestamptz not null default now()
);

create table addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  street text,
  house_number text,
  postal_code text,
  city text,
  country text not null default 'NL'
);

create table notification_prefs (
  user_id uuid primary key references profiles(id) on delete cascade,
  email_enabled boolean not null default true,
  sms_enabled boolean not null default false,
  push_enabled boolean not null default false
);

-- ─────────────────────────────────────────────────────────────────────────────
-- catalog: activities, rooms, instructors, classes
-- ─────────────────────────────────────────────────────────────────────────────
create table activities (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references studios(id) on delete cascade,
  slug text not null,
  name text not null,
  kind text not null check (kind in ('group','appointment','duo','event','vod')),
  default_credit_cost int not null default 1,
  default_duration_minutes int not null default 50,
  unique (studio_id, slug)
);

create table rooms (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references studios(id) on delete cascade,
  name text not null,
  capacity int not null
);

create table instructors (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references studios(id) on delete cascade,
  display_name text not null,
  bio text,
  photo_url text
);

create table classes (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references studios(id) on delete cascade,
  activity_id uuid not null references activities(id),
  instructor_id uuid references instructors(id),
  room_id uuid references rooms(id),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  capacity int not null,
  is_off_peak boolean not null default false,
  status text not null default 'scheduled' check (status in ('scheduled','cancelled','completed')),
  created_at timestamptz not null default now()
);
create index on classes (studio_id, starts_at);

-- ─────────────────────────────────────────────────────────────────────────────
-- products: passes, subscriptions, giftcards
-- ─────────────────────────────────────────────────────────────────────────────
create table passes (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references studios(id) on delete cascade,
  slug text not null,
  name text not null,
  description text,
  price_eur_cents int not null,
  credits int not null,
  validity_days int not null,
  activate_on_first_attendance boolean not null default false,
  off_peak_only boolean not null default false,
  allowed_activity_ids uuid[] not null default '{}',
  active boolean not null default true,
  unique (studio_id, slug)
);

-- Custom credit cost when this pass is used for a given activity
create table pass_activity_credit_costs (
  pass_id uuid references passes(id) on delete cascade,
  activity_id uuid references activities(id) on delete cascade,
  credit_cost int not null,
  primary key (pass_id, activity_id)
);

create table user_passes (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references studios(id),
  user_id uuid not null references profiles(id) on delete cascade,
  pass_id uuid not null references passes(id),
  credits_remaining int not null,
  activated_at timestamptz,
  expires_at timestamptz,
  source text not null check (source in ('purchase','giftcard','refund','manual','referral')),
  created_at timestamptz not null default now()
);
create index on user_passes (user_id, expires_at);

create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references studios(id) on delete cascade,
  slug text not null,
  name text not null,
  price_eur_cents int not null,
  interval text not null default 'month' check (interval in ('week','month','year')),
  credits_per_period int,
  unlimited boolean not null default false,
  credit_rollover boolean not null default false,
  active boolean not null default true,
  unique (studio_id, slug)
);

create table user_subscriptions (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references studios(id),
  user_id uuid not null references profiles(id) on delete cascade,
  subscription_id uuid not null references subscriptions(id),
  mollie_subscription_id text unique,
  status text not null check (status in ('active','paused','cancelled','expired')),
  started_at timestamptz not null default now(),
  current_period_end timestamptz,
  paused_at timestamptz,
  cancelled_at timestamptz
);

create table giftcards (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references studios(id) on delete cascade,
  code text unique not null,
  amount_eur_cents int not null,
  purchaser_id uuid references profiles(id),
  recipient_email citext,
  recipient_name text,
  message text,
  redeemed_by uuid references profiles(id),
  redeemed_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table referrals (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references studios(id),
  owner_id uuid not null references profiles(id) on delete cascade,
  code text unique not null,
  uses_left int not null default 5,
  uses_total int not null default 5,
  recipient_discount_pct int not null default 10,
  sender_credit_eur_cents int not null default 750
);

create table promo_codes (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references studios(id) on delete cascade,
  code text unique not null,
  discount_pct int,
  discount_eur_cents int,
  valid_from timestamptz,
  valid_until timestamptz,
  max_uses int,
  uses int not null default 0
);

-- ─────────────────────────────────────────────────────────────────────────────
-- bookings + waitlist
-- ─────────────────────────────────────────────────────────────────────────────
create table bookings (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references studios(id),
  user_id uuid not null references profiles(id) on delete cascade,
  class_id uuid not null references classes(id) on delete cascade,
  user_pass_id uuid references user_passes(id),
  status text not null check (status in ('booked','cancelled','no_show','waitlisted','attended')),
  credits_used int not null default 0,
  waitlist_position int,
  created_at timestamptz not null default now(),
  cancelled_at timestamptz,
  unique (user_id, class_id)
);
create index on bookings (class_id, status);

-- ─────────────────────────────────────────────────────────────────────────────
-- cart / orders / payments / invoices / wallet
-- ─────────────────────────────────────────────────────────────────────────────
create table carts (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references studios(id),
  user_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references carts(id) on delete cascade,
  item_kind text not null check (item_kind in ('pass','subscription','giftcard','single_booking')),
  pass_id uuid references passes(id),
  subscription_id uuid references subscriptions(id),
  giftcard_id uuid references giftcards(id),
  class_id uuid references classes(id),
  quantity int not null default 1,
  unit_price_eur_cents int not null
);

create table orders (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references studios(id),
  user_id uuid not null references profiles(id) on delete cascade,
  total_eur_cents int not null,
  status text not null check (status in ('pending','paid','failed','cancelled','refunded')),
  mollie_payment_id text unique,
  paid_at timestamptz,
  invoice_number text,
  invoice_pdf_path text,
  wallet_used_eur_cents int not null default 0,
  promo_code_id uuid references promo_codes(id),
  referral_id uuid references referrals(id),
  created_at timestamptz not null default now()
);

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  item_kind text not null,
  pass_id uuid references passes(id),
  subscription_id uuid references subscriptions(id),
  giftcard_id uuid references giftcards(id),
  class_id uuid references classes(id),
  quantity int not null,
  unit_price_eur_cents int not null
);

create table payment_methods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  mollie_customer_id text not null,
  mollie_mandate_id text not null,
  brand text,
  last4 text,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create table wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  delta_eur_cents int not null,
  reason text not null,
  order_id uuid references orders(id),
  created_at timestamptz not null default now()
);

-- Migration shim for House of Eve so existing Webflow links keep working.
create table legacy_bsport_pass_map (
  bsport_id text primary key,
  studio_id uuid not null references studios(id) on delete cascade,
  kind text not null check (kind in ('pass','subscription')),
  pass_id uuid references passes(id),
  subscription_id uuid references subscriptions(id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- audit log
-- ─────────────────────────────────────────────────────────────────────────────
create table audit_log (
  id bigserial primary key,
  studio_id uuid references studios(id),
  actor_id uuid references auth.users(id),
  action text not null,
  entity text,
  entity_id text,
  meta jsonb,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────────────────────
alter table studios enable row level security;
alter table studio_admins enable row level security;
alter table profiles enable row level security;
alter table addresses enable row level security;
alter table notification_prefs enable row level security;
alter table activities enable row level security;
alter table rooms enable row level security;
alter table instructors enable row level security;
alter table classes enable row level security;
alter table passes enable row level security;
alter table pass_activity_credit_costs enable row level security;
alter table user_passes enable row level security;
alter table subscriptions enable row level security;
alter table user_subscriptions enable row level security;
alter table giftcards enable row level security;
alter table referrals enable row level security;
alter table promo_codes enable row level security;
alter table bookings enable row level security;
alter table carts enable row level security;
alter table cart_items enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table payment_methods enable row level security;
alter table wallet_transactions enable row level security;
alter table legacy_bsport_pass_map enable row level security;
alter table audit_log enable row level security;

-- public-readable catalog
create policy "studios readable" on studios for select using (true);
create policy "activities readable" on activities for select using (true);
create policy "instructors readable" on instructors for select using (true);
create policy "rooms readable" on rooms for select using (true);
create policy "classes readable" on classes for select using (true);
create policy "passes readable" on passes for select using (active);
create policy "subscriptions readable" on subscriptions for select using (active);
create policy "legacy_map readable" on legacy_bsport_pass_map for select using (true);

-- per-user data
create policy "own profile" on profiles for all using (id = auth.uid()) with check (id = auth.uid());
create policy "own address" on addresses for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own notif" on notification_prefs for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own user_passes" on user_passes for select using (user_id = auth.uid());
create policy "own user_subscriptions" on user_subscriptions for select using (user_id = auth.uid());
create policy "own bookings" on bookings for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own carts" on carts for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own cart_items" on cart_items for all
  using (exists (select 1 from carts c where c.id = cart_id and c.user_id = auth.uid()))
  with check (exists (select 1 from carts c where c.id = cart_id and c.user_id = auth.uid()));
create policy "own orders" on orders for select using (user_id = auth.uid());
create policy "own order_items" on order_items for select
  using (exists (select 1 from orders o where o.id = order_id and o.user_id = auth.uid()));
create policy "own payment_methods" on payment_methods for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own wallet" on wallet_transactions for select using (user_id = auth.uid());
create policy "own giftcards" on giftcards for select using (purchaser_id = auth.uid() or redeemed_by = auth.uid());
create policy "own referrals" on referrals for select using (owner_id = auth.uid());

-- admin overrides (one per table for write, plus broad read)
create policy "admin all studios" on studios for all using (is_studio_admin(id)) with check (is_studio_admin(id));
create policy "admin all profiles" on profiles for all using (is_studio_admin(studio_id)) with check (is_studio_admin(studio_id));
create policy "admin all bookings" on bookings for all using (is_studio_admin(studio_id)) with check (is_studio_admin(studio_id));
create policy "admin all classes" on classes for all using (is_studio_admin(studio_id)) with check (is_studio_admin(studio_id));
create policy "admin all passes" on passes for all using (is_studio_admin(studio_id)) with check (is_studio_admin(studio_id));
create policy "admin all subscriptions" on subscriptions for all using (is_studio_admin(studio_id)) with check (is_studio_admin(studio_id));
create policy "admin all user_passes" on user_passes for all using (is_studio_admin(studio_id)) with check (is_studio_admin(studio_id));
create policy "admin all user_subs" on user_subscriptions for all using (is_studio_admin(studio_id)) with check (is_studio_admin(studio_id));
create policy "admin all orders" on orders for all using (is_studio_admin(studio_id)) with check (is_studio_admin(studio_id));
create policy "admin all giftcards" on giftcards for all using (is_studio_admin(studio_id)) with check (is_studio_admin(studio_id));
create policy "admin all wallet" on wallet_transactions for all
  using (exists (select 1 from profiles p where p.id = user_id and is_studio_admin(p.studio_id)))
  with check (exists (select 1 from profiles p where p.id = user_id and is_studio_admin(p.studio_id)));
create policy "admin audit" on audit_log for all using (is_studio_admin(studio_id)) with check (is_studio_admin(studio_id));
create policy "admin legacy_map write" on legacy_bsport_pass_map for all using (is_studio_admin(studio_id)) with check (is_studio_admin(studio_id));
