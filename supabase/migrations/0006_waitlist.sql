-- Waitlist sizing: studio-wide default + per-class override.
alter table studios add column if not exists default_max_waitlist int not null default 10;
alter table classes add column if not exists max_waitlist int;

-- Race-to-claim invite tokens. When a seat opens we issue a token to every
-- waitlisted booking; the first claim that flips status from waitlisted →
-- booked while the token still matches wins.
alter table bookings add column if not exists waitlist_invite_token uuid;
alter table bookings add column if not exists waitlist_invited_at timestamptz;
alter table bookings add column if not exists waitlist_claimed_at timestamptz;

-- The original (user_id, class_id) unique would block re-booking after a
-- cancel. Restrict the rule to active rows so the same user can rejoin a
-- waitlist or re-book a class they previously cancelled.
alter table bookings drop constraint if exists bookings_user_id_class_id_key;
create unique index if not exists bookings_active_unique
  on bookings (user_id, class_id) where status in ('booked','waitlisted');

create index if not exists bookings_waitlist_token_idx
  on bookings (waitlist_invite_token) where waitlist_invite_token is not null;
