-- Capture the inviter-supplied name so the admins list shows people, not
-- just email addresses. Applied to profiles.first_name when the invite
-- is redeemed in the auth callback.
alter table studio_admin_invites add column if not exists display_name text;
