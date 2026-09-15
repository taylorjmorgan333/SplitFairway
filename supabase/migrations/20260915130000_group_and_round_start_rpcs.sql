-- RPCs backing "Create a golf group" and the three Start a Round paths
-- (Quick Round / Group Round / Trip Round). Trip Round needs nothing new
-- -- it's just create_round_action against a trip the user already
-- picked, unchanged. Quick Round and Group Round each need a trip to
-- hang their round_players/expenses off of (see the migration-level
-- comment on trips.kind), created here rather than by reusing
-- create_trip() directly so create_trip()'s existing signature, grant,
-- and every caller of it are left completely untouched.

create or replace function public.create_group(
  p_name text,
  p_description text default null
)
returns public.golf_groups
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group public.golf_groups;
  v_profile public.profiles;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if coalesce(trim(p_name), '') = '' then
    raise exception 'Group name is required';
  end if;

  select * into v_profile from public.profiles where id = auth.uid();

  insert into public.golf_groups (created_by, name, description)
  values (auth.uid(), p_name, nullif(trim(coalesce(p_description, '')), ''))
  returning * into v_group;

  insert into public.golf_group_members (group_id, user_id, display_name, email, role)
  values (
    v_group.id,
    auth.uid(),
    coalesce(v_profile.full_name, split_part(auth.email(), '@', 1)),
    lower(auth.email()),
    'owner'
  );

  return v_group;
end;
$$;

grant execute on function public.create_group(text, text) to authenticated;
revoke execute on function public.create_group(text, text) from public;
revoke execute on function public.create_group(text, text) from anon;

-- Shared body for the two "hidden trip" cases -- identical to
-- create_trip()'s own insert (including owner_id, added by a later
-- migration than the version this comment used to describe) (trip + captain trip_member +
-- activity_log) plus setting kind/golf_group_id, kept as its own
-- function (rather than adding parameters to create_trip) so
-- create_trip()'s signature and grant never change.
create or replace function public.create_hosted_round_trip(
  p_name text,
  p_kind public.trip_kind,
  p_golf_group_id uuid default null
)
returns public.trips
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trip public.trips;
  v_profile public.profiles;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_profile from public.profiles where id = auth.uid();

  insert into public.trips (created_by, owner_id, name, currency, kind, golf_group_id)
  values (auth.uid(), auth.uid(), p_name, 'USD', p_kind, p_golf_group_id)
  returning * into v_trip;

  insert into public.trip_members (trip_id, user_id, display_name, email, role, status, joined_at)
  values (
    v_trip.id,
    auth.uid(),
    coalesce(v_profile.full_name, split_part(auth.email(), '@', 1)),
    lower(auth.email()),
    'captain',
    'active',
    now()
  );

  insert into public.activity_log (trip_id, actor_user_id, event_type, event_data)
  values (v_trip.id, auth.uid(), 'trip_created', jsonb_build_object('name', p_name, 'kind', p_kind));

  return v_trip;
end;
$$;

-- Granted to authenticated same as every other RPC here: a caller
-- invoking this directly instead of through start_quick_round_trip()/
-- start_group_round_trip() below only ever creates and captains a trip
-- of their own (identical to what create_trip() already lets them do),
-- and an arbitrary p_golf_group_id on their own trip is harmless
-- metadata -- RLS on golf_groups/golf_group_members still requires
-- actual group membership to read anything, so this grants no access
-- to any group's data.
grant execute on function public.create_hosted_round_trip(text, public.trip_kind, uuid) to authenticated;
revoke execute on function public.create_hosted_round_trip(text, public.trip_kind, uuid) from public;
revoke execute on function public.create_hosted_round_trip(text, public.trip_kind, uuid) from anon;

create or replace function public.start_quick_round_trip()
returns public.trips
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  return public.create_hosted_round_trip(
    'Quick Round – ' || to_char(now(), 'FMMonth FMDD, YYYY'),
    'quick_round'
  );
end;
$$;

grant execute on function public.start_quick_round_trip() to authenticated;
revoke execute on function public.start_quick_round_trip() from public;
revoke execute on function public.start_quick_round_trip() from anon;

create or replace function public.start_group_round_trip(p_group_id uuid)
returns public.trips
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trip public.trips;
  v_group public.golf_groups;
  v_member record;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_group_member(p_group_id) then
    raise exception 'You are not a member of that group';
  end if;

  select * into v_group from public.golf_groups where id = p_group_id;

  v_trip := public.create_hosted_round_trip(v_group.name || ' Round', 'group_round', p_group_id);

  -- Copy the rest of the saved roster in as trip members so they're
  -- immediately pickable on the round's "add golfer" step, exactly like
  -- any manually-added trip member. The caller themself was already
  -- added as captain by create_hosted_round_trip above, so they're
  -- skipped here to avoid a duplicate-email conflict.
  for v_member in
    select display_name, email
    from public.golf_group_members
    where group_id = p_group_id
      and (user_id is distinct from auth.uid())
  loop
    perform public.add_trip_member_manually(v_trip.id, v_member.display_name, v_member.email);
  end loop;

  return v_trip;
end;
$$;

grant execute on function public.start_group_round_trip(uuid) to authenticated;
revoke execute on function public.start_group_round_trip(uuid) from public;
revoke execute on function public.start_group_round_trip(uuid) from anon;

-- Lets a trip captain connect an existing real trip to a saved group
-- (requirement: "Trips may optionally be connected to a saved group").
-- Purely informational -- it doesn't grant either side access to the
-- other's data, so it only needs to check that the caller is entitled
-- to change the trip and is actually a member of the group being linked.
create or replace function public.attach_trip_to_group(p_trip_id uuid, p_group_id uuid)
returns public.trips
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trip public.trips;
begin
  if not public.is_trip_captain(p_trip_id) then
    raise exception 'Only a trip captain can do that';
  end if;

  if p_group_id is not null and not public.is_group_member(p_group_id) then
    raise exception 'You are not a member of that group';
  end if;

  update public.trips set golf_group_id = p_group_id where id = p_trip_id
  returning * into v_trip;

  return v_trip;
end;
$$;

grant execute on function public.attach_trip_to_group(uuid, uuid) to authenticated;
revoke execute on function public.attach_trip_to_group(uuid, uuid) from public;
revoke execute on function public.attach_trip_to_group(uuid, uuid) from anon;
