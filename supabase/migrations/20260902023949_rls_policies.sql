alter table public.profiles enable row level security;
alter table public.trips enable row level security;
alter table public.trip_members enable row level security;
alter table public.trip_invitations enable row level security;
alter table public.expenses enable row level security;
alter table public.expense_shares enable row level security;
alter table public.payments enable row level security;
alter table public.activity_log enable row level security;

grant select, insert, update on public.profiles to authenticated;
grant select, update, delete on public.trips to authenticated;
grant select, insert, update, delete on public.trip_members to authenticated;
grant select on public.trip_invitations to authenticated;
grant select, insert, update, delete on public.expenses to authenticated;
grant select, insert, update, delete on public.expense_shares to authenticated;
grant select, insert, update, delete on public.payments to authenticated;
grant select, insert on public.activity_log to authenticated;

-- profiles
create policy "profiles_select_own_or_trip_mate" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.shares_active_trip_with(id));

create policy "profiles_insert_own" on public.profiles
  for insert to authenticated
  with check (id = auth.uid());

create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- trips (no insert policy: creation goes through create_trip())
create policy "trips_select_members" on public.trips
  for select to authenticated
  using (public.is_trip_member(id));

create policy "trips_update_captain" on public.trips
  for update to authenticated
  using (public.is_trip_captain(id))
  with check (public.is_trip_captain(id));

create policy "trips_delete_captain" on public.trips
  for delete to authenticated
  using (public.is_trip_captain(id));

-- trip_members
create policy "trip_members_select_members" on public.trip_members
  for select to authenticated
  using (public.is_trip_member(trip_id));

create policy "trip_members_insert_captain" on public.trip_members
  for insert to authenticated
  with check (public.is_trip_captain(trip_id));

create policy "trip_members_update_captain" on public.trip_members
  for update to authenticated
  using (public.is_trip_captain(trip_id))
  with check (public.is_trip_captain(trip_id));

create policy "trip_members_delete_captain" on public.trip_members
  for delete to authenticated
  using (public.is_trip_captain(trip_id));

-- trip_invitations (captain-only visibility; mutations via functions)
create policy "trip_invitations_select_captain" on public.trip_invitations
  for select to authenticated
  using (public.is_trip_captain(trip_id));

-- expenses (treasurer model: captain manages, all members view)
create policy "expenses_select_members" on public.expenses
  for select to authenticated
  using (public.is_trip_member(trip_id));

create policy "expenses_insert_captain" on public.expenses
  for insert to authenticated
  with check (public.is_trip_captain(trip_id) and created_by = auth.uid());

create policy "expenses_update_captain" on public.expenses
  for update to authenticated
  using (public.is_trip_captain(trip_id))
  with check (public.is_trip_captain(trip_id));

create policy "expenses_delete_captain" on public.expenses
  for delete to authenticated
  using (public.is_trip_captain(trip_id));

-- expense_shares (mirrors the parent expense's captain-only management)
create policy "expense_shares_select_members" on public.expense_shares
  for select to authenticated
  using (exists (
    select 1 from public.expenses e
    where e.id = expense_shares.expense_id and public.is_trip_member(e.trip_id)
  ));

create policy "expense_shares_insert_captain" on public.expense_shares
  for insert to authenticated
  with check (exists (
    select 1 from public.expenses e
    where e.id = expense_shares.expense_id and public.is_trip_captain(e.trip_id)
  ));

create policy "expense_shares_update_captain" on public.expense_shares
  for update to authenticated
  using (exists (
    select 1 from public.expenses e
    where e.id = expense_shares.expense_id and public.is_trip_captain(e.trip_id)
  ))
  with check (exists (
    select 1 from public.expenses e
    where e.id = expense_shares.expense_id and public.is_trip_captain(e.trip_id)
  ));

create policy "expense_shares_delete_captain" on public.expense_shares
  for delete to authenticated
  using (exists (
    select 1 from public.expenses e
    where e.id = expense_shares.expense_id and public.is_trip_captain(e.trip_id)
  ));

-- payments (any member reports their own; captain confirms/rejects only
-- via confirm_payment()/reject_payment() below)
create policy "payments_select_members" on public.payments
  for select to authenticated
  using (public.is_trip_member(trip_id));

create policy "payments_insert_own_report" on public.payments
  for insert to authenticated
  with check (public.is_trip_member(trip_id) and reported_by = auth.uid() and status = 'reported');

create policy "payments_update_own_pending" on public.payments
  for update to authenticated
  using (reported_by = auth.uid() and status = 'reported')
  with check (reported_by = auth.uid() and status = 'reported');

create policy "payments_delete_own_pending" on public.payments
  for delete to authenticated
  using (reported_by = auth.uid() and status = 'reported');

-- activity_log (append-only, visible to all members)
create policy "activity_log_select_members" on public.activity_log
  for select to authenticated
  using (public.is_trip_member(trip_id));

create policy "activity_log_insert_members" on public.activity_log
  for insert to authenticated
  with check (public.is_trip_member(trip_id) and actor_user_id = auth.uid());
