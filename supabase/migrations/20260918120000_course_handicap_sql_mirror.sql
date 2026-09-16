-- Course Handicap support for the one code path that runs entirely in
-- Postgres and so cannot call the TypeScript calculation in
-- src/lib/golf/handicap.ts#calculateCourseHandicap: accept_group_invitation()'s
-- "add me to today's already-in-progress round automatically" step
-- (see 20260916160000_group_invitation_access_fixes.sql), which
-- previously wrote the golfer's raw Handicap Index straight into
-- round_players.playing_handicap, the same bug src/actions/rounds.ts
-- had. calculate_course_handicap() below is a deliberate SQL mirror of
-- the TypeScript function -- same WHS formula, same rounding rule --
-- kept in sync by hand since Postgres cannot import it. Every other
-- write path in this app (src/actions/rounds.ts) calls the real
-- TypeScript function via src/lib/golf/round-snapshot.ts#computeCourseHandicap,
-- so this SQL copy exists only for this one security-definer RPC.

create or replace function public.calculate_course_handicap(
  p_handicap_index numeric,
  p_slope_rating numeric,
  p_course_rating numeric,
  p_par numeric
) returns numeric
language sql
immutable
as $$
  select case
    when p_handicap_index is null or p_slope_rating is null or p_course_rating is null or p_par is null
      then null
    -- floor(x + 0.5) rounds an exact .5 upward/toward positive infinity
    -- for both positive and negative values (Postgres's own round()
    -- rounds half AWAY from zero instead, e.g. round(-2.5) = -3, which
    -- would disagree with roundHandicap()'s documented -2.5 -> -2).
    else floor(p_handicap_index * (p_slope_rating / 113.0) + (p_course_rating - p_par) + 0.5)
  end;
$$;

comment on function public.calculate_course_handicap is
  'SQL mirror of src/lib/golf/handicap.ts#calculateCourseHandicap (Course Handicap = Handicap Index x (Slope Rating/113) + (Course Rating-Par), WHS formula, rounded with the same "0.5 rounds upward" rule for both signs). Used only by accept_group_invitation(), the one round_players write path that runs entirely in Postgres. Every other write path (src/actions/rounds.ts) calls the real TypeScript function -- see src/lib/golf/handicap.test.ts for the worked examples both implementations must agree on.';

-- Re-point accept_group_invitation()'s automatic "add to today's
-- in-progress round" step at calculate_course_handicap() instead of the
-- raw Handicap Index. Identical to the version in
-- 20260916160000_group_invitation_access_fixes.sql except for the
-- round_players insert at the end.
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
  v_tee jsonb;
  v_tee_par numeric;
  v_handicap_index numeric;
  v_course_handicap numeric;
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

      v_handicap_index := coalesce(v_golf_profile.handicap_index, v_member.default_handicap_index);

      -- Look up the chosen tee in this round's own immutable snapshot
      -- (never the live course_tee_sets table -- see the historical
      -- accuracy requirement) to get the Rating/Slope/Par actually in
      -- effect for this round.
      select t.value into v_tee
      from public.round_course_snapshots s,
           lateral jsonb_array_elements(s.tee_sets) as t(value)
      where s.round_id = v_current_round.id
        and t.value ->> 'name' = v_member.preferred_tee_name
      limit 1;

      select sum((h.value ->> 'par')::numeric) into v_tee_par
      from jsonb_array_elements(coalesce(v_tee -> 'holes', '[]'::jsonb)) as h(value);

      v_course_handicap := public.calculate_course_handicap(
        v_handicap_index,
        (v_tee ->> 'slope_rating')::numeric,
        (v_tee ->> 'course_rating')::numeric,
        v_tee_par
      );

      insert into public.round_players (
        round_id, trip_member_id, tee_set_name,
        profile_handicap_index, profile_handicap_source, profile_handicap_revision_date,
        course_handicap, playing_handicap, playing_handicap_source, handicap_entered_by
      )
      values (
        v_current_round.id, v_trip_member.id, v_member.preferred_tee_name,
        v_golf_profile.handicap_index, v_golf_profile.handicap_source, v_golf_profile.handicap_revision_date,
        v_course_handicap,
        coalesce(v_course_handicap, v_handicap_index),
        -- 'legacy' doubles here as "not a verified Course Handicap
        -- conversion" (missing tee/Rating/Slope at auto-join time), not
        -- only "predates this feature" -- either way the round setup UI
        -- will show it as needing a look rather than a resolved
        -- calculation, and never as a silent manual override.
        case when v_course_handicap is not null then 'calculated' else 'legacy' end,
        auth.uid()
      );
    end if;
  end if;

  return jsonb_build_object('group_id', v_invitation.group_id, 'role', v_invitation.invited_role);
end;
$$;
