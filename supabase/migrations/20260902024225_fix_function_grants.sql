-- Supabase grants EXECUTE directly to anon/authenticated by default
-- (not via the PUBLIC pseudo-role), so the previous migration's
-- `revoke ... from public` had no effect on those roles. Revoke from
-- the actual roles instead.

revoke execute on function public.set_updated_at() from anon, authenticated;
revoke execute on function public.handle_new_user() from anon, authenticated;
revoke execute on function public.prevent_removing_last_captain() from anon, authenticated;

revoke execute on function public.is_trip_member(uuid) from anon;
revoke execute on function public.is_trip_captain(uuid) from anon;
revoke execute on function public.shares_active_trip_with(uuid) from anon;
