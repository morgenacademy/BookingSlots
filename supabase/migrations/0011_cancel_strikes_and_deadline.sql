-- Bump default cancel deadline to 8 hours.
alter table studios alter column cancel_deadline_minutes set default 480;
update studios set cancel_deadline_minutes = 480 where cancel_deadline_minutes = 360;

-- Strike counter on active subscriptions (3 strikes = EUR 15 fine).
alter table user_subscriptions
  add column if not exists late_cancel_strikes int not null default 0;

create table if not exists subscription_penalties (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references studios(id) on delete cascade,
  user_subscription_id uuid not null references user_subscriptions(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  amount_eur_cents int not null,
  reason text not null,
  status text not null default 'open' check (status in ('open','paid','waived')),
  created_at timestamptz not null default now()
);
create index if not exists subscription_penalties_user_idx on subscription_penalties (user_id, status);

alter table subscription_penalties enable row level security;
drop policy if exists "own penalties" on subscription_penalties;
create policy "own penalties" on subscription_penalties
  for select using (user_id = auth.uid());
drop policy if exists "admin all penalties" on subscription_penalties;
create policy "admin all penalties" on subscription_penalties
  for all using (is_studio_admin(studio_id)) with check (is_studio_admin(studio_id));
