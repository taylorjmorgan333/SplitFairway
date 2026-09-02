-- Creates a trip and makes the creator its first captain, atomically.
create or replace function public.create_trip(
  p_name text,
  p_destination text default null,
  p_start_date date default null,
  p_end_date date default null,
  p_currency text default 'USD',
  p_description text default null
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

  if coalesce(trim(p_name), '') = '' then
    raise exception 'Trip name is required';
  end if;

  select * into v_profile from public.profiles where id = auth.uid();

  insert into public.trips (created_by, name, destination, start_date, end_date, currency, description)
  values (auth.uid(), p_name, p_destination, p_start_date, p_end_date, coalesce(nullif(p_currency, ''), 'USD'), p_description)
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
  values (v_trip.id, auth.uid(), 'trip_created', jsonb_build_object('name', p_name));

  return v_trip;
end;
$$;

grant execute on function public.create_trip(text, text, date, date, text, text) to authenticated;

-- Invites someone to a trip as either a member or a co-treasurer
-- (captain). Only an existing captain may call this. Returns the raw
-- invitation token exactly once, for the app to send by email — it is
-- never stored in plaintext.
create or replace function public.invite_trip_member(
  p_trip_id uuid,
  p_email text,
  p_display_name text,
  p_role public.member_role default 'member'
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_member public.trip_members;
  v_raw_token text;
  v_token_hash text;
begin
  if not public.is_trip_captain(p_trip_id) then
    raise exception 'Only a trip captain can invite members';
  end if;

  if exists (
    select 1 from public.trip_members
    where trip_id = p_trip_id and lower(email) = lower(p_email) and status in ('invited', 'active')
  ) then
    raise exception 'This email already has an active membership or pending invite for this trip';
  end if;

  insert into public.trip_members (trip_id, user_id, display_name, email, role, status)
  values (p_trip_id, null, p_display_name, lower(p_email), p_role, 'invited')
  returning * into v_member;

  v_raw_token := encode(extensions.gen_random_bytes(32), 'hex');
  v_token_hash := encode(extensions.digest(v_raw_token, 'sha256'), 'hex');

  insert into public.trip_invitations (trip_id, email, invited_by, token_hash, expires_at)
  values (p_trip_id, lower(p_email), auth.uid(), v_token_hash, now() + interval '14 days');

  insert into public.activity_log (trip_id, actor_user_id, event_type, event_data)
  values (p_trip_id, auth.uid(), 'member_invited', jsonb_build_object('email', lower(p_email), 'role', p_role));

  return jsonb_build_object('trip_member_id', v_member.id, 'token', v_raw_token);
end;
$$;

grant execute on function public.invite_trip_member(uuid, text, text, public.member_role) to authenticated;

-- Promote or demote an existing active member. Captain-only. The
-- trg_prevent_removing_last_captain trigger blocks demoting the last
-- captain on a trip.
create or replace function public.set_trip_member_role(
  p_trip_member_id uuid,
  p_role public.member_role
)
returns public.trip_members
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member public.trip_members;
begin
  select * into v_member from public.trip_members where id = p_trip_member_id;
  if not found then
    raise exception 'Trip member not found';
  end if;

  if not public.is_trip_captain(v_member.trip_id) then
    raise exception 'Only a trip captain can change member roles';
  end if;

  update public.trip_members
  set role = p_role
  where id = p_trip_member_id
  returning * into v_member;

  insert into public.activity_log (trip_id, actor_user_id, event_type, event_data)
  values (v_member.trip_id, auth.uid(), 'member_role_changed', jsonb_build_object('trip_member_id', v_member.id, 'role', p_role));

  return v_member;
end;
$$;

grant execute on function public.set_trip_member_role(uuid, public.member_role) to authenticated;

-- Accept an invitation by presenting its raw token. Must be signed in
-- with the invited email address.
create or replace function public.accept_trip_invitation(p_token text)
returns public.trip_members
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_invitation public.trip_invitations;
  v_member public.trip_members;
  v_user_email text;
  v_token_hash text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select email into v_user_email from auth.users where id = auth.uid();
  v_token_hash := encode(extensions.digest(p_token, 'sha256'), 'hex');

  select * into v_invitation
  from public.trip_invitations
  where token_hash = v_token_hash
    and accepted_at is null
    and expires_at > now();

  if not found then
    raise exception 'This invitation is invalid or has expired';
  end if;

  if lower(v_invitation.email) <> lower(v_user_email) then
    raise exception 'This invitation was sent to a different email address';
  end if;

  select * into v_member
  from public.trip_members
  where trip_id = v_invitation.trip_id and lower(email) = lower(v_invitation.email) and status = 'invited';

  if not found then
    raise exception 'No pending membership found for this invitation';
  end if;

  update public.trip_members
  set user_id = auth.uid(), status = 'active', joined_at = now()
  where id = v_member.id
  returning * into v_member;

  update public.trip_invitations set accepted_at = now() where id = v_invitation.id;

  insert into public.activity_log (trip_id, actor_user_id, event_type, event_data)
  values (v_invitation.trip_id, auth.uid(), 'member_joined', jsonb_build_object('email', v_invitation.email));

  return v_member;
end;
$$;

grant execute on function public.accept_trip_invitation(text) to authenticated;

-- Decline an invitation by token. Allowed pre-signup, since declining
-- doesn't require an account — only possession of the emailed token.
create or replace function public.decline_trip_invitation(p_token text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_invitation public.trip_invitations;
  v_token_hash text;
begin
  v_token_hash := encode(extensions.digest(p_token, 'sha256'), 'hex');

  select * into v_invitation
  from public.trip_invitations
  where token_hash = v_token_hash
    and accepted_at is null
    and expires_at > now();

  if not found then
    raise exception 'This invitation is invalid or has expired';
  end if;

  update public.trip_members
  set status = 'declined'
  where trip_id = v_invitation.trip_id
    and lower(email) = lower(v_invitation.email)
    and status = 'invited';

  insert into public.activity_log (trip_id, actor_user_id, event_type, event_data)
  values (v_invitation.trip_id, null, 'invitation_declined', jsonb_build_object('email', v_invitation.email));
end;
$$;

grant execute on function public.decline_trip_invitation(text) to anon, authenticated;

-- Confirm a reported payment. Captain-only. Only path by which a
-- payment's status can move to 'confirmed'.
create or replace function public.confirm_payment(p_payment_id uuid)
returns public.payments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payments;
begin
  select * into v_payment from public.payments where id = p_payment_id;
  if not found then
    raise exception 'Payment not found';
  end if;

  if not public.is_trip_captain(v_payment.trip_id) then
    raise exception 'Only a trip captain can confirm payments';
  end if;

  if v_payment.status <> 'reported' then
    raise exception 'Only a reported payment can be confirmed';
  end if;

  update public.payments
  set status = 'confirmed', confirmed_by = auth.uid(), confirmed_at = now()
  where id = p_payment_id
  returning * into v_payment;

  insert into public.activity_log (trip_id, actor_user_id, event_type, event_data)
  values (v_payment.trip_id, auth.uid(), 'payment_confirmed', jsonb_build_object('payment_id', v_payment.id, 'amount_cents', v_payment.amount_cents));

  return v_payment;
end;
$$;

grant execute on function public.confirm_payment(uuid) to authenticated;

-- Reject a reported payment. Captain-only.
create or replace function public.reject_payment(p_payment_id uuid, p_reason text default null)
returns public.payments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payments;
begin
  select * into v_payment from public.payments where id = p_payment_id;
  if not found then
    raise exception 'Payment not found';
  end if;

  if not public.is_trip_captain(v_payment.trip_id) then
    raise exception 'Only a trip captain can reject payments';
  end if;

  if v_payment.status <> 'reported' then
    raise exception 'Only a reported payment can be rejected';
  end if;

  update public.payments
  set status = 'rejected', confirmed_by = auth.uid(), confirmed_at = now()
  where id = p_payment_id
  returning * into v_payment;

  insert into public.activity_log (trip_id, actor_user_id, event_type, event_data)
  values (v_payment.trip_id, auth.uid(), 'payment_rejected', jsonb_build_object('payment_id', v_payment.id, 'reason', p_reason));

  return v_payment;
end;
$$;

grant execute on function public.reject_payment(uuid, text) to authenticated;
