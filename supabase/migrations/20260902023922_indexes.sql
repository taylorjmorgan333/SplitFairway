create index idx_trips_created_by on public.trips(created_by);
create index idx_trips_status on public.trips(status);

create index idx_trip_members_trip_id on public.trip_members(trip_id);
create index idx_trip_members_user_id on public.trip_members(user_id);
create unique index uq_trip_members_active_user on public.trip_members(trip_id, user_id) where (status = 'active' and user_id is not null);
create unique index uq_trip_members_pending_email on public.trip_members(trip_id, lower(email)) where (status in ('invited', 'active'));

create index idx_trip_invitations_trip_id on public.trip_invitations(trip_id);
create index idx_trip_invitations_email on public.trip_invitations(lower(email));

create index idx_expenses_trip_id on public.expenses(trip_id);
create index idx_expenses_paid_by_member_id on public.expenses(paid_by_member_id);

create index idx_expense_shares_expense_id on public.expense_shares(expense_id);
create index idx_expense_shares_trip_member_id on public.expense_shares(trip_member_id);

create index idx_payments_trip_id on public.payments(trip_id);
create index idx_payments_payer_member_id on public.payments(payer_member_id);
create index idx_payments_recipient_member_id on public.payments(recipient_member_id);
create index idx_payments_status on public.payments(status);

create index idx_activity_log_trip_id on public.activity_log(trip_id);
create index idx_activity_log_created_at on public.activity_log(created_at desc);
