-- The real gap: Postgres grants EXECUTE to the PUBLIC pseudo-role on
-- every new function by default, independent of any anon/authenticated
-- grants. A prior migration revoked anon's *direct* grant on these
-- functions, which succeeded (anon has no explicit ACL entry below),
-- but anon still inherited access through the leftover PUBLIC grant,
-- as confirmed live via has_function_privilege('anon', ...) = true.
-- This revokes the PUBLIC grant itself, matching the pattern already
-- used correctly for is_trip_member/is_trip_captain/shares_active_trip_with
-- in the security_hardening_and_perf migration.
revoke execute on function public.create_trip(text, text, date, date, text, text) from public;
revoke execute on function public.invite_trip_member(uuid, text, text, public.member_role) from public;
revoke execute on function public.accept_trip_invitation(text) from public;
revoke execute on function public.confirm_payment(uuid) from public;
revoke execute on function public.reject_payment(uuid, text) from public;
revoke execute on function public.set_trip_member_role(uuid, public.member_role) from public;

-- decline_trip_invitation is the deliberate exception: declining only
-- needs the token, not an account, so anon keeps access to it.

do $$
declare
  v_still_allowed text;
  v_authenticated_missing text;
begin
  select string_agg(p.proname, ', ')
  into v_still_allowed
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in (
      'create_trip', 'invite_trip_member', 'accept_trip_invitation',
      'confirm_payment', 'reject_payment', 'set_trip_member_role'
    )
    and has_function_privilege('anon', p.oid, 'execute');

  if v_still_allowed is not null then
    raise exception 'anon can still execute: %', v_still_allowed;
  end if;

  select string_agg(p.proname, ', ')
  into v_authenticated_missing
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in (
      'create_trip', 'invite_trip_member', 'accept_trip_invitation',
      'confirm_payment', 'reject_payment', 'set_trip_member_role'
    )
    and not has_function_privilege('authenticated', p.oid, 'execute');

  if v_authenticated_missing is not null then
    raise exception 'authenticated lost execute on: %', v_authenticated_missing;
  end if;
end $$;
