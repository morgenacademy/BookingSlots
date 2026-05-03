-- The 0001 init enables RLS on instructors/rooms/activities but only adds
-- public read policies. Without these admin write policies inserts/updates
-- from the back-office silently return zero rows.
create policy "admin all instructors" on instructors
  for all using (is_studio_admin(studio_id)) with check (is_studio_admin(studio_id));

create policy "admin all rooms" on rooms
  for all using (is_studio_admin(studio_id)) with check (is_studio_admin(studio_id));

create policy "admin all activities" on activities
  for all using (is_studio_admin(studio_id)) with check (is_studio_admin(studio_id));
