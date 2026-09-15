-- SplitFairway daily-use revamp (Phase 2), continued: closes a real
-- access gap the new group-invitation feature (item 6) exposed. Every
-- rounds/round_players/hole_scores/etc. RLS policy is trip-scoped
-- (is_trip_member(trips.id) -- a trip_members row with user_id =
-- auth.uid()) -- but joining a golf_group via golf_group_members never
-- created one. Two consequences, one pre-existing and one new:
--
--   1. (Pre-existing, since Phase 1) loadGroupLeaderboard/round-history
--      queries run as the signed-in viewer, so any registered group
--      member OTHER than the owner saw an empty leaderboard/history --
--      RLS silently filtered every round out, since they had no
--      trip_members row on any of the group's hidden trips.
--   2. (New) an invited "guest" has no way to "view the relevant round
--      and enter permitted scores" (spec item 6) without one either.
--
-- Fixed two ways, both additive:
--   a) start_group_round_trip now links a registered member's real
--      trip_members.user_id directly (instead of always routing through
--      add_trip_member_manually, which only ever creates user_id-null
--      rows) -- so every future Group Round a member is selected into
--      gives them real, permanent access to their own round.
--   b) accept_group_invitation grants immediate access to the group's
--      most recently started trip/round at accept time -- otherwise a
--      member or guest joining mid-week would have to wait for the
--      *next* Group Round for (a) above to help them.
-- Plus new, purely additive (OR'd with the existing trip-member
-- policies, never replacing them) SELECT policies scoped by
-- is_group_member(trips.golf_group_id), so any group member can read
-- (never write) a round linked to their group even before either fix
-- above applies to them.

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

  for v_member in
    select user_id, display_name, email
    from public.golf_group_members
    where group_id = p_group_id
      and (user_id is distinct from auth.uid())
  loop
    if v_member.user_id is not null then
      insert into public.trip_members (trip_id, user_id, display_name, email, role, status, joined_at)
      values (v_trip.id, v_member.user_id, v_member.display_name, v_member.email, 'member', 'active', now());
    else
      perform public.add_trip_member_manually(v_trip.id, v_member.display_name, v_member.email);
    end if;
  end loop;

  return v_trip;
end;
$$;

create or replace function public.start_group_round_trip(p_group_id uuid, p_member_ids uuid[])
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
  v_new_trip_member public.trip_members;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_group_member(p_group_id) then
    raise exception 'You are not a member of that group';
  end if;

  select * into v_group from public.golf_groups where id = p_group_id;

  v_trip := public.create_hosted_round_trip(v_group.name || ' Round', 'group_round', p_group_id);

  for v_member in
    select id, user_id, display_name, email
    from public.golf_group_members
    where group_id = p_group_id
      and (user_id is distinct from auth.uid())
      and (p_member_ids is not null and id = any(p_member_ids))
  loop
    if v_member.user_id is not null then
      insert into public.trip_members (trip_id, user_id, display_name, email, role, status, joined_at)
      values (v_trip.id, v_member.user_id, v_member.display_name, v_member.email, 'member', 'active', now())
      returning * into v_new_trip_member;
      v_mapping := v_mapping || jsonb_build_object(v_member.id::text, v_new_trip_member.id::text);
    else
      v_add_result := public.add_trip_member_manually(v_trip.id, v_member.display_name, v_member.email);
      v_mapping := v_mapping || jsonb_build_object(v_member.id::text, v_add_result->>'trip_member_id');
    end if;
  end loop;

  return jsonb_build_object('trip', to_jsonb(v_trip), 'member_map', v_mapping);
end;
$$;

-- accept_group_invitation: also grants access to the group's current
-- trip/round right away (see (b) above), instead of only golf_group_members
-- membership. Idempotent -- re-running (a reused link visited twice) never
-- inserts a duplicate trip_members or round_players row.
create or replace function public.accept_group_invitation(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_token_hash text;
  v_invitation public.golf_group_invitations;
  v_user_email text;
  v_existing public.golf_group_members;
  v_profile public.profiles;
  v_member public.golf_group_members;
  v_latest_trip_id uuid;
  v_trip_member public.trip_members;
  v_current_round record;
  v_golf_profile record;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  v_token_hash := encode(extensions.digest(p_token, 'sha256'), 'hex');
  select * into v_invitation from public.golf_group_invitations where token_hash = v_token_hash;
  if not found then
    raise exception 'This invitation link is invalid';
  end if;
  if v_invitation.status = 'revoked' then
    raise exception 'This invitation has been revoked';
  end if;
  if v_invitation.expires_at <= now() then
    raise exception 'This invitation has expired';
  end if;
  if v_invitation.status = 'accepted' and v_invitation.email is not null then
    raise exception 'This invitation has already been used';
  end if;

  select email into v_user_email from auth.users where id = auth.uid();
  if v_invitation.email is not null and lower(v_invitation.email) <> lower(v_user_email) then
    raise exception 'This invitation was sent to a different email address';
  end if;

  select * into v_existing
  from public.golf_group_members
  where group_id = v_invitation.group_id and user_id = auth.uid();

  if found then
    v_member := v_existing;
  else
    select * into v_profile from public.profiles where id = auth.uid();
    insert into public.golf_group_members (group_id, user_id, display_name, email, role)
    values (
      v_invitation.group_id,
      auth.uid(),
      coalesce(v_profile.full_name, split_part(v_user_email, '@', 1)),
      lower(v_user_email),
      'member'
    )
    returning * into v_member;
  end if;

  if v_invitation.email is not null then
    update public.golf_group_invitations set status = 'accepted', accepted_at = now() where id = v_invitation.id;
  end if;

  -- Immediate access: join the group's most recently started trip as a
  -- real trip_member (if not already one), and, if that trip has a
  -- round currently in progress, add a round_players row too -- so a
  -- guest (or a member) who joins mid-week can see and score today's
  -- round right away rather than waiting for the next one.
  select id into v_latest_trip_id
  from public.trips
  where golf_group_id = v_invitation.group_id
  order by created_at desc
  limit 1;

  if v_latest_trip_id is not null then
    select * into v_trip_member
    from public.trip_members
    where trip_id = v_latest_trip_id and user_id = auth.uid();

    if not found then
      insert into public.trip_members (trip_id, user_id, display_name, email, role, status, joined_at)
      values (v_latest_trip_id, auth.uid(), v_member.display_name, lower(v_user_email), 'member', 'active', now())
      returning * into v_trip_member;
    end if;

    select r.id, r.hole_count into v_current_round
    from public.rounds r
    where r.trip_id = v_latest_trip_id and r.status = 'in_progress'
    order by r.round_date desc
    limit 1;

    if v_current_round.id is not null and not exists (
      select 1 from public.round_players where round_id = v_current_round.id and trip_member_id = v_trip_member.id
    ) then
      select handicap_index, handicap_source, handicap_revision_date into v_golf_profile
      from public.golf_profiles where user_id = auth.uid();

      insert into public.round_players (
        round_id, trip_member_id, tee_set_name,
        profile_handicap_index, profile_handicap_source, profile_handicap_revision_date,
        playing_handicap, handicap_entered_by
      )
      values (
        v_current_round.id, v_trip_member.id, v_member.preferred_tee_name,
        v_golf_profile.handicap_index, v_golf_profile.handicap_source, v_golf_profile.handicap_revision_date,
        coalesce(v_golf_profile.handicap_index, v_member.default_handicap_index),
        auth.uid()
      );
    end if;
  end if;

  return jsonb_build_object('group_id', v_invitation.group_id, 'role', v_invitation.invited_role);
end;
$$;

-- Additive group-scoped SELECT policies -- OR'd with the existing
-- trip-member-based ones on each table, never replacing them.
create policy "trips_select_group_members" on public.trips
  for select to authenticated
  using (golf_group_id is not null and public.is_group_member(golf_group_id));

create policy "rounds_select_group_members" on public.rounds
  for select to authenticated
  using (exists (
    select 1 from public.trips t
    where t.id = rounds.trip_id and t.golf_group_id is not null and public.is_group_member(t.golf_group_id)
  ));

create policy "round_players_select_group_members" on public.round_players
  for select to authenticated
  using (exists (
    select 1 from public.rounds r
    join public.trips t on t.id = r.trip_id
    where r.id = round_players.round_id and t.golf_group_id is not null and public.is_group_member(t.golf_group_id)
  ));

create policy "round_course_snapshots_select_group_members" on public.round_course_snapshots
  for select to authenticated
  using (exists (
    select 1 from public.rounds r
    join public.trips t on t.id = r.trip_id
    where r.id = round_course_snapshots.round_id and t.golf_group_id is not null and public.is_group_member(t.golf_group_id)
  ));

create policy "hole_scores_select_group_members" on public.hole_scores
  for select to authenticated
  using (exists (
    select 1 from public.round_players rp
    join public.rounds r on r.id = rp.round_id
    join public.trips t on t.id = r.trip_id
    where rp.id = hole_scores.round_player_id and t.golf_group_id is not null and public.is_group_member(t.golf_group_id)
  ));

create policy "side_games_select_group_members" on public.side_games
  for select to authenticated
  using (exists (
    select 1 from public.rounds r
    join public.trips t on t.id = r.trip_id
    where r.id = side_games.round_id and t.golf_group_id is not null and public.is_group_member(t.golf_group_id)
  ));

create policy "side_game_participants_select_group_members" on public.side_game_participants
  for select to authenticated
  using (exists (
    select 1 from public.side_games sg
    join public.rounds r on r.id = sg.round_id
    join public.trips t on t.id = r.trip_id
    where sg.id = side_game_participants.side_game_id and t.golf_group_id is not null and public.is_group_member(t.golf_group_id)
  ));
