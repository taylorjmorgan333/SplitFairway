-- SplitFairway daily-use revamp (Phase 2): group invitation RPCs.
-- Mirrors invite_trip_member/accept_trip_invitation/revoke_trip_invitation/
-- get_invitation_preview as closely as the different (nullable-email,
-- reusable link) shape allows. Rate limiting is inlined against
-- golf_group_invitations itself rather than enforce_rate_limit(), which
-- is hard-wired to trip-scoped activity_log rows.

create or replace function public.create_group_invitation(
  p_group_id uuid,
  p_email text default null,
  p_role public.golf_group_invitation_role default 'member'
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_email text := nullif(lower(trim(coalesce(p_email, ''))), '');
  v_count int;
  v_raw_token text;
  v_token_hash text;
  v_invitation_id uuid;
begin
  if not public.is_group_owner(p_group_id) then
    raise exception 'Only the group owner can invite someone';
  end if;

  select count(*) into v_count
  from public.golf_group_invitations
  where group_id = p_group_id
    and invited_by = auth.uid()
    and created_at > now() - interval '1 hour';
  if v_count >= 20 then
    raise exception 'Too many invitations sent recently — please wait a bit before trying again.';
  end if;

  v_raw_token := encode(extensions.gen_random_bytes(32), 'hex');
  v_token_hash := encode(extensions.digest(v_raw_token, 'sha256'), 'hex');

  insert into public.golf_group_invitations (group_id, email, invited_role, token_hash, invited_by, expires_at)
  values (p_group_id, v_email, p_role, v_token_hash, auth.uid(), now() + interval '14 days')
  returning id into v_invitation_id;

  return jsonb_build_object('invitation_id', v_invitation_id, 'token', v_raw_token, 'email', v_email);
end;
$$;

revoke execute on function public.create_group_invitation(uuid, text, public.golf_group_invitation_role) from public;
revoke execute on function public.create_group_invitation(uuid, text, public.golf_group_invitation_role) from anon;
grant execute on function public.create_group_invitation(uuid, text, public.golf_group_invitation_role) to authenticated;

create or replace function public.revoke_group_invitation(p_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invitation public.golf_group_invitations;
begin
  select * into v_invitation from public.golf_group_invitations where id = p_invitation_id;
  if not found then
    raise exception 'Invitation not found';
  end if;
  if not public.is_group_owner(v_invitation.group_id) then
    raise exception 'Only the group owner can revoke an invitation';
  end if;
  if v_invitation.status <> 'pending' then
    raise exception 'Only a pending invitation can be revoked';
  end if;

  update public.golf_group_invitations set status = 'revoked' where id = p_invitation_id;
end;
$$;

revoke execute on function public.revoke_group_invitation(uuid) from public;
revoke execute on function public.revoke_group_invitation(uuid) from anon;
grant execute on function public.revoke_group_invitation(uuid) to authenticated;

-- Anon-callable, deliberately minimal -- see the comment on
-- golf_group_invitations above. Never returns roster, trip, or
-- financial data, only enough to render "You're invited to join
-- <group name>".
create or replace function public.get_group_invitation_preview(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_token_hash text;
  v_invitation public.golf_group_invitations;
  v_group public.golf_groups;
begin
  if coalesce(trim(p_token), '') = '' then
    return jsonb_build_object('status', 'not_found');
  end if;

  v_token_hash := encode(extensions.digest(p_token, 'sha256'), 'hex');
  select * into v_invitation from public.golf_group_invitations where token_hash = v_token_hash;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  select * into v_group from public.golf_groups where id = v_invitation.group_id;

  if v_invitation.status = 'revoked' then
    return jsonb_build_object('status', 'revoked', 'group_name', v_group.name);
  end if;
  if v_invitation.status = 'declined' then
    return jsonb_build_object('status', 'declined', 'group_name', v_group.name);
  end if;
  if v_invitation.status = 'accepted' then
    return jsonb_build_object('status', 'accepted', 'group_name', v_group.name);
  end if;
  if v_invitation.expires_at <= now() then
    return jsonb_build_object('status', 'expired', 'group_name', v_group.name);
  end if;

  return jsonb_build_object(
    'status', 'pending',
    'group_name', v_group.name,
    'role', v_invitation.invited_role
  );
end;
$$;

revoke execute on function public.get_group_invitation_preview(text) from public;
grant execute on function public.get_group_invitation_preview(text) to anon;
grant execute on function public.get_group_invitation_preview(text) to authenticated;

-- Accept: idempotent for link invites (email null) -- revisiting or a
-- second person using the same shared link just returns their existing
-- membership rather than erroring, so the link stays reusable. A named
-- invite (email set) is single-use, exactly like a trip invitation:
-- the accepting account's email must match, and it flips to 'accepted'.
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

  return jsonb_build_object('group_id', v_invitation.group_id, 'role', v_invitation.invited_role);
end;
$$;

revoke execute on function public.accept_group_invitation(text) from public;
revoke execute on function public.accept_group_invitation(text) from anon;
grant execute on function public.accept_group_invitation(text) to authenticated;
