-- Self-serve account deletion.
--
-- Policy (also documented in src/app/legal/data-deletion/page.tsx for
-- users, and in the Phase 3 section of the production-readiness work):
--
--  1. A trip where the deleting user is the ONLY active member (any
--     role) is entirely their own — no other golfer has any stake in
--     it — so the whole trip, and everything on it (expenses,
--     expense_shares, payments, activity_log, trip_members,
--     trip_invitations), is hard-deleted via the existing ON DELETE
--     CASCADE foreign keys on public.trips.
--
--  2. A trip with OTHER active members is never deleted. The deleting
--     user's own trip_members row is anonymized (display name replaced,
--     email replaced with a non-deliverable placeholder, user_id
--     cleared) but the ROW STAYS, and every expense_share/payment
--     referencing it is untouched — those other golfers' balances must
--     keep adding up correctly. This is "remove personally identifying
--     details, keep the ledger," matching what the data-deletion page
--     has always told users would happen.
--
--  3. If removing this user leaves a shared trip with zero remaining
--     active captains, the longest-tenured remaining active member is
--     promoted to captain (and made the trip's owner if this user was
--     the owner) — otherwise the remaining golfers would be locked out
--     of managing their own trip through no fault of their own. This is
--     a side effect of removing the departing captain, not a change to
--     any other golfer's financial data.
--
--  4. beta_feedback and analytics_events rows are deleted, not
--     anonymized: both tables declare user_id as NOT NULL BY DESIGN
--     (they're per-user telemetry with no meaning detached from a
--     user), both already cascade from profiles(id) on delete, and
--     deleting outright is strictly more private than trying to keep an
--     anonymized row around.
--
--  5. profiles, and every other public-schema reference to this user
--     (trips.created_by/owner_id, trip_invitations.invited_by,
--     expenses.created_by, payments.reported_by/confirmed_by,
--     activity_log.actor_user_id) already either cascades or is
--     declared ON DELETE SET NULL — those happen automatically the
--     moment the auth.users row is deleted, no extra statements needed
--     here.
--
--  6. The auth.users row itself is deleted by this SAME function
--     (rather than via the Admin API from application code), which is
--     what lets account deletion run entirely through a normal
--     authenticated RLS-respecting request with NO service-role key
--     anywhere in the production environment — deliberately consistent
--     with this project's existing choice (see README/.env.example) to
--     never set SUPABASE_SERVICE_ROLE_KEY in Vercel. SECURITY DEFINER
--     functions created by a migration run with the privileges of their
--     owner (the migration role), which has the necessary rights on the
--     auth schema in Supabase; deleting auth.users cascades to
--     auth.sessions/auth.refresh_tokens/auth.identities via Supabase's
--     own schema, invalidating any active session immediately.

create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_solo_trip_ids uuid[];
  v_shared_trip record;
  v_successor public.trip_members;
  v_remaining_captains int;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Step 1: trips where this user is the only active member of any
  -- role — theirs alone, safe to delete entirely.
  select array_agg(t.id) into v_solo_trip_ids
  from public.trips t
  where exists (
    select 1 from public.trip_members tm
    where tm.trip_id = t.id and tm.user_id = v_user_id and tm.status = 'active'
  )
  and not exists (
    select 1 from public.trip_members tm2
    where tm2.trip_id = t.id and tm2.status = 'active' and tm2.user_id is distinct from v_user_id
  );

  if v_solo_trip_ids is not null then
    delete from public.trips where id = any(v_solo_trip_ids);
  end if;

  -- Step 2/3: every remaining trip this user is still an active member
  -- of has other active golfers on it — anonymize, never delete, and
  -- backfill captain/owner if this user was the last captain standing.
  for v_shared_trip in
    select tm.trip_id, tm.role, t.owner_id
    from public.trip_members tm
    join public.trips t on t.id = tm.trip_id
    where tm.user_id = v_user_id and tm.status = 'active'
  loop
    update public.trip_members
    set display_name = 'Former member',
        email = concat('deleted-', id::text, '@deleted.splitfairwaygolf.com'),
        user_id = null
    where trip_id = v_shared_trip.trip_id and user_id = v_user_id;

    if v_shared_trip.role = 'captain' then
      select count(*) into v_remaining_captains
      from public.trip_members
      where trip_id = v_shared_trip.trip_id and role = 'captain' and status = 'active';

      if v_remaining_captains = 0 then
        select * into v_successor
        from public.trip_members
        where trip_id = v_shared_trip.trip_id and status = 'active'
        order by coalesce(joined_at, created_at) asc
        limit 1;

        if found then
          update public.trip_members set role = 'captain' where id = v_successor.id;

          update public.trips
          set owner_id = coalesce(v_successor.user_id, owner_id),
              updated_at = now()
          where id = v_shared_trip.trip_id
            and (owner_id = v_user_id or owner_id is null);

          insert into public.activity_log (trip_id, actor_user_id, event_type, event_data)
          values (
            v_shared_trip.trip_id, null, 'captain_auto_promoted',
            jsonb_build_object('new_captain_trip_member_id', v_successor.id, 'reason', 'previous captain deleted their account')
          );
        end if;
      end if;
    end if;
  end loop;

  -- Step 4: per-user telemetry, deleted outright (see notes above).
  delete from public.beta_feedback where user_id = v_user_id;
  delete from public.analytics_events where user_id = v_user_id;

  -- Step 5/6: delete the auth identity itself. Cascades to profiles
  -- (ON DELETE CASCADE) and, from there, sets every remaining
  -- created_by/owner_id/invited_by/reported_by/confirmed_by/
  -- actor_user_id reference to this user to NULL, per each column's
  -- existing ON DELETE SET NULL.
  delete from auth.users where id = v_user_id;
end;
$$;

comment on function public.delete_own_account() is
  'Deletes the calling user''s own account: hard-deletes trips solely theirs, anonymizes their roster entry (keeping the ledger intact) on shared trips, backfills a captain/owner if needed, deletes their own feedback/analytics, then deletes their auth identity. Callable only by an authenticated user, only on themselves (auth.uid()) — there is no parameter to target another account.';

revoke execute on function public.delete_own_account() from public;
revoke execute on function public.delete_own_account() from anon;
grant execute on function public.delete_own_account() to authenticated;

do $$
begin
  if has_function_privilege('anon', 'public.delete_own_account()', 'execute') then
    raise exception 'anon must not be able to execute delete_own_account';
  end if;
  if not has_function_privilege('authenticated', 'public.delete_own_account()', 'execute') then
    raise exception 'authenticated must be able to execute delete_own_account';
  end if;
end $$;
