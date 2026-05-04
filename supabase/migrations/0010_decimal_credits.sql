-- Half credits: every credit column to numeric(5,1) so 0.5 / 1.5 are valid.
alter table activities       alter column default_credit_cost type numeric(5,1) using default_credit_cost::numeric;
alter table passes           alter column credits             type numeric(5,1) using credits::numeric;
alter table user_passes      alter column credits_remaining   type numeric(5,1) using credits_remaining::numeric;
alter table subscriptions    alter column credits_per_period  type numeric(5,1) using credits_per_period::numeric;
alter table bookings         alter column credits_used        type numeric(5,1) using credits_used::numeric;
alter table pass_activity_credit_costs
  alter column credit_cost type numeric(5,1) using credit_cost::numeric;
