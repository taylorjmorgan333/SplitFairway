-- SplitFairway daily-use revamp (Phase 2), continued: replaces the
-- 2-argument start_group_round_trip's return type from public.trips to
-- jsonb so it can also hand back a golf_group_members.id ->
-- trip_members.id mapping, built during the very same loop that
-- creates each trip_members row. The fast Group Round flow
-- (src/actions/group-rounds.ts) needs this to add round_players for
-- exactly the golfers selected -- matching by email alone would be
-- ambiguous whenever a guest has no saved email (add_trip_member_manually
-- allows this), so the mapping is built authoritatively here instead of
-- guessed at from the client.
drop function if exists public.start_group_round_trip(uuid, uuid[]);

create function public.start_group_round_trip(p_group_id uuid, p_member_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trip public.trips;
  v_group public.golf_groups;
  v_member record;
  v_add_result jsonb;
  v_mapping jsonb := '{}'::jsonb;
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
  for v_member in
    select id, display_name, email
    from public.golf_group_members
    where group_id = p_group_id
      and (user_id is distinct from auth.uid())
      and (p_member_ids is not null and id = any(p_member_ids))
  loop
    v_add_result := public.add_trip_member_manually(v_trip.id, v_member.display_name, v_member.email);
    v_mapping := v_mapping || jsonb_build_object(v_member.id::text, v_add_result->>'trip_member_id');
  end loop;

  return jsonb_build_object('trip', to_jsonb(v_trip), 'member_map', v_mapping);
end;
$$;

grant execute on function public.start_group_round_trip(uuid, uuid[]) to authenticated;
revoke execute on function public.start_group_round_trip(uuid, uuid[]) from public;
revoke execute on function public.start_group_round_trip(uuid, uuid[]) from anon;
