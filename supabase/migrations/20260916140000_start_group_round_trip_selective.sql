-- SplitFairway daily-use revamp (Phase 2): a second, additive overload
-- of start_group_round_trip that lets the fast Group Round flow add
-- only the golfers actually selected for today's round as trip_members,
-- instead of the whole saved roster every time. The original
-- start_group_round_trip(uuid) is untouched (still used wherever it
-- already was) -- Postgres/PostgREST resolve which overload to call by
-- which named arguments a caller actually passes, so nothing that
-- already calls the one-argument version is affected.
create or replace function public.start_group_round_trip(p_group_id uuid, p_member_ids uuid[])
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

  -- Same "skip the caller, everyone else goes through
  -- add_trip_member_manually" logic as the one-argument version, just
  -- additionally filtered down to the golfers selected for this round.
  -- A null or empty p_member_ids adds no one but the caller -- the fast
  -- flow always passes at least the golfers it shows selected, so this
  -- only matters if it's ever called with an empty selection.
  for v_member in
    select display_name, email
    from public.golf_group_members
    where group_id = p_group_id
      and (user_id is distinct from auth.uid())
      and (p_member_ids is not null and id = any(p_member_ids))
  loop
    perform public.add_trip_member_manually(v_trip.id, v_member.display_name, v_member.email);
  end loop;

  return v_trip;
end;
$$;

grant execute on function public.start_group_round_trip(uuid, uuid[]) to authenticated;
revoke execute on function public.start_group_round_trip(uuid, uuid[]) from public;
revoke execute on function public.start_group_round_trip(uuid, uuid[]) from anon;
