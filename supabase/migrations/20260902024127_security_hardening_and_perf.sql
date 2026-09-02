-- Pin search_path on the updated_at trigger function
alter function public.set_updated_at() set search_path = public;

-- Trigger-only functions should never be directly callable via the
-- PostgREST RPC surface. Trigger firing does not require EXECUTE
-- privilege on the function, so this only removes an unnecessary
-- public API endpoint.
revoke execute on function public.set_updated_at() from public;
revoke execute on function public.handle_new_user() from public;
revoke execute on function public.prevent_removing_last_captain() from public;

-- Internal RLS helper functions: needed by `authenticated` (RLS policy
-- evaluation runs as the querying role), not by `anon` or the public
-- role generally.
revoke execute on function public.is_trip_member(uuid) from public;
grant execute on function public.is_trip_member(uuid) to authenticated;

revoke execute on function public.is_trip_captain(uuid) from public;
grant execute on function public.is_trip_captain(uuid) to authenticated;

revoke execute on function public.shares_active_trip_with(uuid) from public;
grant execute on function public.shares_active_trip_with(uuid) to authenticated;

-- Cover remaining unindexed foreign keys the advisor flagged.
create index idx_activity_log_actor_user_id on public.activity_log(actor_user_id);
create index idx_expenses_created_by on public.expenses(created_by);
create index idx_payments_confirmed_by on public.payments(confirmed_by);
create index idx_payments_reported_by on public.payments(reported_by);
create index idx_trip_invitations_invited_by on public.trip_invitations(invited_by);

-- Avoid re-evaluating auth.uid() per row in RLS policies (evaluate once
-- per statement instead).
alter policy "profiles_select_own_or_trip_mate" on public.profiles
  using ((select auth.uid()) = id or public.shares_active_trip_with(id));

alter policy "profiles_insert_own" on public.profiles
  with check ((select auth.uid()) = id);

alter policy "profiles_update_own" on public.profiles
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

alter policy "expenses_insert_captain" on public.expenses
  with check (public.is_trip_captain(trip_id) and created_by = (select auth.uid()));

alter policy "payments_insert_own_report" on public.payments
  with check (public.is_trip_member(trip_id) and reported_by = (select auth.uid()) and status = 'reported');

alter policy "payments_update_own_pending" on public.payments
  using (reported_by = (select auth.uid()) and status = 'reported')
  with check (reported_by = (select auth.uid()) and status = 'reported');

alter policy "payments_delete_own_pending" on public.payments
  using (reported_by = (select auth.uid()) and status = 'reported');

alter policy "activity_log_insert_members" on public.activity_log
  with check (public.is_trip_member(trip_id) and actor_user_id = (select auth.uid()));
