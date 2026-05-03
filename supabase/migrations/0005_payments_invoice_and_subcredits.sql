-- Subscription credits live in user_passes too, but they aren't tied to a
-- pass template — they reference the user_subscription that granted them.
alter table user_passes alter column pass_id drop not null;
alter table user_passes add column if not exists user_subscription_id uuid
  references user_subscriptions(id) on delete cascade;

-- Sequential, per-studio per-year invoice numbering. Generated atomically
-- via a SECURITY DEFINER function so concurrent webhook calls don't collide.
create table if not exists invoice_sequence (
  studio_id uuid not null references studios(id) on delete cascade,
  year int not null,
  next_value int not null default 1,
  primary key (studio_id, year)
);

alter table invoice_sequence enable row level security;
drop policy if exists "admin invoice sequence" on invoice_sequence;
create policy "admin invoice sequence" on invoice_sequence
  for all using (is_studio_admin(studio_id)) with check (is_studio_admin(studio_id));

create or replace function next_invoice_number(p_studio uuid, p_year int, p_prefix text)
returns text language plpgsql security definer as $$
declare
  v int;
begin
  insert into invoice_sequence (studio_id, year, next_value)
  values (p_studio, p_year, 2)
  on conflict (studio_id, year) do update
    set next_value = invoice_sequence.next_value + 1
  returning next_value - 1 into v;
  return coalesce(p_prefix, 'INV') || '-' || p_year || '-' || lpad(v::text, 5, '0');
end;
$$;

create index if not exists orders_status_idx on orders (status);
