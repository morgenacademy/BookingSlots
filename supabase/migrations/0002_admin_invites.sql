-- Pending admin invites. When a person with this email next signs in, the
-- callback promotes them into studio_admins and deletes the invite.
create table studio_admin_invites (
  studio_id uuid not null references studios(id) on delete cascade,
  email text not null,
  role text not null check (role in ('owner','manager','staff')),
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (studio_id, email)
);

alter table studio_admin_invites enable row level security;

create policy "admin manage invites" on studio_admin_invites
  for all using (is_studio_admin(studio_id)) with check (is_studio_admin(studio_id));
