-- Instructor login: link instructors row to an auth user, with a pending
-- invite-email that the auth callback redeems on first sign-in.
alter table instructors add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table instructors add column if not exists invite_email citext;
create unique index if not exists instructors_user_unique
  on instructors (studio_id, user_id) where user_id is not null;

create policy "instructor reads own bookings" on bookings
  for select using (
    exists (
      select 1 from classes c
      join instructors i on i.id = c.instructor_id
      where c.id = bookings.class_id and i.user_id = auth.uid()
    )
  );

create policy "instructor reads own attendees" on profiles
  for select using (
    exists (
      select 1 from bookings b
      join classes c on c.id = b.class_id
      join instructors i on i.id = c.instructor_id
      where b.user_id = profiles.id and i.user_id = auth.uid()
    )
  );
