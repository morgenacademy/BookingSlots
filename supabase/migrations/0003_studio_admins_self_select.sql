-- Without this, RLS hides studio_admins rows from the very user they belong
-- to, so the admin layout's `count(*) where user_id = auth.uid()` always
-- returns 0 and admins get bounced to /account.
create policy "own admin row" on studio_admins
  for select using (user_id = auth.uid());
