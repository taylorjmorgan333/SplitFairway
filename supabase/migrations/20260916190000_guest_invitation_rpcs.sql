-- SplitFairway Phase 2 cleanup: passwordless guest scoring, step 3 --
-- the RPCs. Five functions: one captain-only creation call that does
-- the trip_members + round_players + invitation insert in one
-- transaction, one anon-callable preview (mirrors
-- get_group_invitation_preview's minimal-projection pattern exactly),
-- one redeem call (the only one an anonymous auth session ever
-- calls), and captain-only revoke/regenerate.

-- Captain-only. Creates the guest's identity (trip_members,
-- is_guest = true, user_id null until redeemed) and adds them to the
-- named round (round_players) in the same call -- reuses the exact
-- columns addRoundPlayerAction/addNewGolferToRoundAction already
-- write, nothing new about how a golfer joins a round. p_group_id is
-- accepted only to stamp onto the invitation row for display context
-- (see the guest invitations list UI) -- authorization is always via
-- is_trip_captain(p_trip_id), never group ownership, matching
-- round_players_insert_captain's own gate.
create or replace function public.create_group_guest_invitation(
  p_trip_id uuid,
  p_round_id uuid,
  p_guest_display_name text,
  p_group_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_name text := nullif(trim(coalesce(p_guest_display_name, '')), '');
  v_round public.rounds;
  v_trip_member public.trip_members;
  v_round_player public.round_players;
  v_raw_token text;
  v_token_hash text;
  v_invitation_id uuid;
begin
  if not public.is_trip_captain(p_trip_id) then
    raise exception 'Only the trip captain can invite a guest to score';
  end if;

  select * into v_round from public.rounds where id = p_round_id;
  if not found or v_round.trip_id <> p_trip_id then
    raise exception 'That round does not belong to this trip';
  end if;
  if v_round.status = 'locked' then
    raise exception 'This round is locked -- a guest cannot be added to it anymore';
  end if;

  if v_name is null then
    v_name := 'Guest';
  end if;
  if char_length(v_name) > 60 then
    raise exception 'That guest name is too long (max 60 characters)';
  end if;

  perform public.enforce_rate_limit(p_trip_id, 'guest_invitation_created', interval '1 hour', 20);

  insert into public.trip_members (trip_id, user_id, display_name, email, role, status, joined_at, is_guest)
  values (p_trip_id, null, v_name, null, 'member', 'active', now(), true)
  returning * into v_trip_member;

  insert into public.round_players (round_id, trip_member_id, handicap_entered_by)
  values (p_round_id, v_trip_member.id, auth.uid())
  returning * into v_round_player;

  v_raw_token := encode(extensions.gen_random_bytes(32), 'hex');
  v_token_hash := encode(extensions.digest(v_raw_token, 'sha256'), 'hex');

  insert into public.golf_group_guest_invitations (
    group_id, trip_id, round_id, trip_member_id, round_player_id,
    guest_display_name, token_hash, created_by, expires_at
  )
  values (
    p_group_id, p_trip_id, p_round_id, v_trip_member.id, v_round_player.id,
    v_name, v_token_hash, auth.uid(), now() + interval '14 days'
  )
  returning id into v_invitation_id;

  insert into public.activity_log (trip_id, actor_user_id, event_type, event_data)
  values (p_trip_id, auth.uid(), 'guest_invitation_created', jsonb_build_object('guest_display_name', v_name, 'round_id', p_round_id));

  return jsonb_build_object('invitation_id', v_invitation_id, 'token', v_raw_token, 'guest_display_name', v_name);
end;
$$;

revoke execute on function public.create_group_guest_invitation(uuid, uuid, text, uuid) from public;
revoke execute on function public.create_group_guest_invitation(uuid, uuid, text, uuid) from anon;
grant execute on function public.create_group_guest_invitation(uuid, uuid, text, uuid) to authenticated;

-- Anon-callable, deliberately minimal -- never roster, never
-- financial data, never any other round's info. Just enough to render
-- "You're invited to score at <course>, <date>" before anyone signs
-- in (anonymously or otherwise).
create or replace function public.get_guest_invitation_preview(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_token_hash text;
  v_invitation public.golf_group_guest_invitations;
  v_group public.golf_groups;
  v_snapshot public.round_course_snapshots;
  v_round public.rounds;
begin
  if coalesce(trim(p_token), '') = '' then
    return jsonb_build_object('status', 'not_found');
  end if;

  v_token_hash := encode(extensions.digest(p_token, 'sha256'), 'hex');
  select * into v_invitation from public.golf_group_guest_invitations where token_hash = v_token_hash;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  if v_invitation.group_id is not null then
    select * into v_group from public.golf_groups where id = v_invitation.group_id;
  end if;
  select * into v_round from public.rounds where id = v_invitation.round_id;
  select * into v_snapshot from public.round_course_snapshots where round_id = v_invitation.round_id;

  if v_invitation.status = 'revoked' then
    return jsonb_build_object('status', 'revoked', 'guest_display_name', v_invitation.guest_display_name);
  end if;
  if v_invitation.expires_at <= now() then
    return jsonb_build_object('status', 'expired', 'guest_display_name', v_invitation.guest_display_name);
  end if;

  return jsonb_build_object(
    'status', 'pending',
    'guest_display_name', v_invitation.guest_display_name,
    'group_name', v_group.name,
    'course_name', v_snapshot.course_name,
    'round_date', v_round.round_date
  );
end;
$$;

revoke execute on function public.get_guest_invitation_preview(text) from public;
grant execute on function public.get_guest_invitation_preview(text) to anon;
grant execute on function public.get_guest_invitation_preview(text) to authenticated;

-- The only function a guest's own (anonymous or real) session ever
-- calls. Requires auth.uid() to already exist -- the caller
-- (redeemGuestInvitationAction) is responsible for having already
-- established a session (anonymous sign-in, or the caller's existing
-- real session if they happen to already be logged in) before this
-- runs; that is a deliberate split so this function never has to
-- decide anything about auth itself. Relinking is idempotent and
-- re-runnable on purpose (see guest_invitation_status''s comment) --
-- every tap of "Continue as <name>" simply (re)points the trip_member
-- row at whoever is asking right now and reactivates it, which is
-- also how regenerate/resume-after-revoke ends up working with no
-- separate "reactivate" code path.
create or replace function public.redeem_group_guest_invitation(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_token_hash text;
  v_invitation public.golf_group_guest_invitations;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  v_token_hash := encode(extensions.digest(p_token, 'sha256'), 'hex');
  select * into v_invitation from public.golf_group_guest_invitations where token_hash = v_token_hash;
  if not found then
    raise exception 'This guest link is invalid';
  end if;
  if v_invitation.status = 'revoked' then
    raise exception 'This guest link has been turned off by the captain';
  end if;
  if v_invitation.expires_at <= now() then
    raise exception 'This guest link has expired -- ask your captain for a new one';
  end if;

  update public.trip_members
  set user_id = auth.uid(), status = 'active'
  where id = v_invitation.trip_member_id;

  update public.golf_group_guest_invitations
  set status = 'redeemed', redeemed_user_id = auth.uid(), redeemed_at = now()
  where id = v_invitation.id;

  return jsonb_build_object(
    'trip_id', v_invitation.trip_id,
    'round_id', v_invitation.round_id,
    'trip_member_id', v_invitation.trip_member_id,
    'round_player_id', v_invitation.round_player_id,
    'guest_display_name', v_invitation.guest_display_name
  );
end;
$$;

revoke execute on function public.redeem_group_guest_invitation(text) from public;
revoke execute on function public.redeem_group_guest_invitation(text) from anon;
grant execute on function public.redeem_group_guest_invitation(text) to authenticated;

-- Captain-only. Cuts off live access immediately (not just future
-- redemptions) by also setting the linked trip_members row to
-- 'removed' -- is_trip_member/is_guest_trip_member both require
-- status = 'active', so this takes effect on the guest's very next
-- request, mid-round or not. Their round_players/hole_scores rows are
-- untouched -- revoking access is not the same as removing them from
-- the round (the trip captain can still do that separately, the same
-- way they remove any other golfer, via the existing round player
-- "Remove" action).
create or replace function public.revoke_group_guest_invitation(p_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invitation public.golf_group_guest_invitations;
begin
  select * into v_invitation from public.golf_group_guest_invitations where id = p_invitation_id;
  if not found then
    raise exception 'Guest invitation not found';
  end if;
  if not public.is_trip_captain(v_invitation.trip_id) then
    raise exception 'Only the trip captain can revoke a guest invitation';
  end if;

  update public.golf_group_guest_invitations
  set status = 'revoked', revoked_at = now()
  where id = p_invitation_id;

  update public.trip_members set status = 'removed' where id = v_invitation.trip_member_id;
end;
$$;

revoke execute on function public.revoke_group_guest_invitation(uuid) from public;
revoke execute on function public.revoke_group_guest_invitation(uuid) from anon;
grant execute on function public.revoke_group_guest_invitation(uuid) to authenticated;

-- Captain-only. Retires the old token (revoked, so a leaked/old link
-- stops working) and issues a fresh one for the *same* guest golfer --
-- same trip_member_id/round_player_id, so any scores already entered
-- are untouched -- and reactivates trip_members in case it had been
-- revoked. This is what "regenerate access" means here: a new link to
-- hand out, not a new golfer.
create or replace function public.regenerate_group_guest_invitation(p_invitation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_old public.golf_group_guest_invitations;
  v_raw_token text;
  v_token_hash text;
  v_new_id uuid;
begin
  select * into v_old from public.golf_group_guest_invitations where id = p_invitation_id;
  if not found then
    raise exception 'Guest invitation not found';
  end if;
  if not public.is_trip_captain(v_old.trip_id) then
    raise exception 'Only the trip captain can regenerate a guest invitation';
  end if;

  update public.golf_group_guest_invitations
  set status = 'revoked', revoked_at = now()
  where id = p_invitation_id and status <> 'revoked';

  update public.trip_members set status = 'active' where id = v_old.trip_member_id;

  v_raw_token := encode(extensions.gen_random_bytes(32), 'hex');
  v_token_hash := encode(extensions.digest(v_raw_token, 'sha256'), 'hex');

  insert into public.golf_group_guest_invitations (
    group_id, trip_id, round_id, trip_member_id, round_player_id,
    guest_display_name, token_hash, created_by, expires_at
  )
  values (
    v_old.group_id, v_old.trip_id, v_old.round_id, v_old.trip_member_id, v_old.round_player_id,
    v_old.guest_display_name, v_token_hash, auth.uid(), now() + interval '14 days'
  )
  returning id into v_new_id;

  return jsonb_build_object('invitation_id', v_new_id, 'token', v_raw_token, 'guest_display_name', v_old.guest_display_name);
end;
$$;

revoke execute on function public.regenerate_group_guest_invitation(uuid) from public;
revoke execute on function public.regenerate_group_guest_invitation(uuid) from anon;
grant execute on function public.regenerate_group_guest_invitation(uuid) to authenticated;
