-- Beta-launch hardening: Supabase's default schema privileges grant
-- anon (and authenticated) broad table-level access — SELECT, INSERT,
-- UPDATE, DELETE, etc. — on every table created in `public`, confirmed
-- live via information_schema.role_table_grants. Every one of this
-- project's tables has Row Level Security enabled with policies scoped
-- `to authenticated` only, so an anon request already gets zero rows
-- and zero affected writes regardless of the table grant — RLS is the
-- real boundary, exactly as it already is for every SECURITY DEFINER
-- function in this project (see the "two-revoke" migrations).
--
-- This migration adds a second, redundant layer on top of that for
-- defense in depth: anon's table-level grant is revoked outright, so
-- an anonymous request is blocked at the grant level before RLS even
-- runs — not just because every current policy happens to be scoped
-- correctly. authenticated's grants are untouched.
revoke all on public.trips from anon;
revoke all on public.trip_members from anon;
revoke all on public.trip_invitations from anon;
revoke all on public.expenses from anon;
revoke all on public.expense_shares from anon;
revoke all on public.payments from anon;
revoke all on public.activity_log from anon;
revoke all on public.profiles from anon;

-- Self-verify: fail loudly if anon retains any privilege on any of
-- these tables, or if authenticated lost the access it needs.
do $$
declare
  v_table text;
  v_priv text;
  v_tables text[] := array[
    'trips', 'trip_members', 'trip_invitations', 'expenses',
    'expense_shares', 'payments', 'activity_log', 'profiles'
  ];
  v_privs text[] := array['SELECT', 'INSERT', 'UPDATE', 'DELETE'];
begin
  foreach v_table in array v_tables loop
    foreach v_priv in array v_privs loop
      if has_table_privilege('anon', format('public.%I', v_table), v_priv) then
        raise exception 'anon must not have % on %', v_priv, v_table;
      end if;
    end loop;
  end loop;

  if not has_table_privilege('authenticated', 'public.trips', 'SELECT') then
    raise exception 'authenticated lost SELECT on trips';
  end if;
  if not has_table_privilege('authenticated', 'public.payments', 'INSERT') then
    raise exception 'authenticated lost INSERT on payments';
  end if;
end $$;
