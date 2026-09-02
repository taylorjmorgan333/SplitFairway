-- Invitation lifecycle, trip ownership transfer, recipient-confirmed
-- payments, and rate limiting for invitation/reminder actions.

-- ---------------------------------------------------------------------
-- 1. Invitation status, tracked explicitly instead of inferred from
--    accepted_at/expires_at alone — this is what makes "resend" and
--    "revoke" possible without mutating history, and what makes token
--    reuse impossible to mistake for a fresh invitation.
-- ---------------------------------------------------------------------
create type public.invitation_status as enum ('pending', 'accepted', 'declined', 'revoked');

alter table public.trip_invitations
  add column status public.invitation_status not null default 'pending';

update public.trip_invitations set status = 'accepted' where accepted_at is not null;

create index idx_trip_invitations_status on public.trip_invitations(trip_id, status);

-- ---------------------------------------------------------------------
-- 2. Trip ownership, distinct from (and starting equal to) the
--    creating captain. All captains keep equal day-to-day authority —
--    ownership is a single, transferable, explicitly-confirmed
--    administrative designation on top of that, not an extra
--    permission captains lack.
-- ---------------------------------------------------------------------
alter table public.trips
  add column owner_id uuid references public.profiles(id) on delete set null;

update public.trips set owner_id = created_by where owner_id is null;

create index idx_trips_owner_id on public.trips(owner_id);

-- ---------------------------------------------------------------------
-- 3. Rate limiting, shared by every invitation/reminder RPC below.
--    Counts this actor's own recent activity_log entries of the given
--    type on this trip — no new table needed, and every RPC already
--    writes an activity_log row on success, so the log doubles as the
--    rate-limit ledger.
-- ---------------------------------------------------------------------
create or replace function public.enforce_rate_limit(
  p_trip_id uuid,
  p_event_type text,
  p_window interval,
  p_max_count int
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  select count(*) into v_count
  from public.activity_log
  where trip_id = p_trip_id
    and event_type = p_event_type
    and actor_user_id = auth.uid()
    and created_at > now() - p_window;

  if v_count >= p_max_count then
    raise exception 'Too many % actions recently — please wait a bit before trying again.', p_event_type;
  end if;
end;
$$;

revoke execute on function public.enforce_rate_limit(uuid, text, interval, int) from public;
revoke execute on function public.enforce_rate_limit(uuid, text, interval, int) from anon;
grant execute on function public.enforce_rate_limit(uuid, text, interval, int) to authenticated;

-- ---------------------------------------------------------------------
-- 4. create_trip(): now also sets owner_id.
-- ---------------------------------------------------------------------
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

  insert into public.trips (created_by, owner_id, name, destination, start_date, end_date, currency, description)
  values (auth.uid(), auth.uid(), p_name, p_destination, p_start_date, p_end_date, coalesce(nullif(p_currency, ''), 'USD'), p_description)
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

-- ---------------------------------------------------------------------
-- 5. invite_trip_member(): unchanged behavior, now rate-limited.
-- ---------------------------------------------------------------------
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

  perform public.enforce_rate_limit(p_trip_id, 'member_invited', interval '1 hour', 20);

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

  insert into public.trip_invitations (trip_id, email, invited_by, token_hash, expires_at, status)
  values (p_trip_id, lower(p_email), auth.uid(), v_token_hash, now() + interval '14 days', 'pending');

  insert into public.activity_log (trip_id, actor_user_id, event_type, event_data)
  values (p_trip_id, auth.uid(), 'member_invited', jsonb_build_object('email', lower(p_email), 'role', p_role));

  return jsonb_build_object('trip_member_id', v_member.id, 'token', v_raw_token);
end;
$$;

-- ---------------------------------------------------------------------
-- 6. resend_trip_invitation(): revokes any still-pending invitation
--    for this member and issues a fresh token — the old copied link
--    stops working the instant a new one exists.
-- ---------------------------------------------------------------------
create or replace function public.resend_trip_invitation(p_trip_member_id uuid)
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
  select * into v_member from public.trip_members where id = p_trip_member_id;
  if not found then
    raise exception 'Trip member not found';
  end if;

  if not public.is_trip_captain(v_member.trip_id) then
    raise exception 'Only a trip captain can resend an invitation';
  end if;

  if v_member.status <> 'invited' then
    raise exception 'Only a pending invitation can be resent';
  end if;

  perform public.enforce_rate_limit(v_member.trip_id, 'invitation_resent', interval '1 hour', 10);

  update public.trip_invitations
  set status = 'revoked'
  where trip_id = v_member.trip_id and lower(email) = lower(v_member.email) and status = 'pending';

  v_raw_token := encode(extensions.gen_random_bytes(32), 'hex');
  v_token_hash := encode(extensions.digest(v_raw_token, 'sha256'), 'hex');

  insert into public.trip_invitations (trip_id, email, invited_by, token_hash, expires_at, status)
  values (v_member.trip_id, lower(v_member.email), auth.uid(), v_token_hash, now() + interval '14 days', 'pending');

  insert into public.activity_log (trip_id, actor_user_id, event_type, event_data)
  values (v_member.trip_id, auth.uid(), 'invitation_resent', jsonb_build_object('trip_member_id', v_member.id, 'email', v_member.email));

  return jsonb_build_object('trip_member_id', v_member.id, 'token', v_raw_token);
end;
$$;

-- ---------------------------------------------------------------------
-- 7. revoke_trip_invitation(): cancels a pending invite outright.
-- ---------------------------------------------------------------------
create or replace function public.revoke_trip_invitation(p_trip_member_id uuid)
returns void
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
    raise exception 'Only a trip captain can revoke an invitation';
  end if;

  if v_member.status <> 'invited' then
    raise exception 'Only a pending invitation can be revoked';
  end if;

  update public.trip_invitations
  set status = 'revoked'
  where trip_id = v_member.trip_id and lower(email) = lower(v_member.email) and status = 'pending';

  update public.trip_members
  set status = 'removed'
  where id = p_trip_member_id;

  insert into public.activity_log (trip_id, actor_user_id, event_type, event_data)
  values (v_member.trip_id, auth.uid(), 'invitation_revoked', jsonb_build_object('trip_member_id', v_member.id, 'email', v_member.email));
end;
$$;

-- ---------------------------------------------------------------------
-- 8. accept/decline: rewritten as atomic check-and-set UPDATEs, so a
--    token can never be consumed twice even under a race (e.g. a
--    double click, or two tabs). A wrong-account acceptance attempt
--    rolls the invitation back to 'pending' rather than burning it,
--    since the token wasn't actually misused — the right person can
--    still use it.
-- ---------------------------------------------------------------------
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

  update public.trip_invitations
  set status = 'accepted', accepted_at = now()
  where token_hash = v_token_hash
    and status = 'pending'
    and expires_at > now()
  returning * into v_invitation;

  if not found then
    raise exception 'This invitation is invalid, expired, or has already been used';
  end if;

  if lower(v_invitation.email) <> lower(v_user_email) then
    update public.trip_invitations set status = 'pending', accepted_at = null where id = v_invitation.id;
    raise exception 'This invitation was sent to a different email address';
  end if;

  select * into v_member
  from public.trip_members
  where trip_id = v_invitation.trip_id and lower(email) = lower(v_invitation.email) and status = 'invited';

  if not found then
    update public.trip_invitations set status = 'pending', accepted_at = null where id = v_invitation.id;
    raise exception 'No pending membership found for this invitation';
  end if;

  update public.trip_members
  set user_id = auth.uid(), status = 'active', joined_at = now()
  where id = v_member.id
  returning * into v_member;

  insert into public.activity_log (trip_id, actor_user_id, event_type, event_data)
  values (v_invitation.trip_id, auth.uid(), 'member_joined', jsonb_build_object('email', v_invitation.email));

  return v_member;
end;
$$;

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

  update public.trip_invitations
  set status = 'declined'
  where token_hash = v_token_hash
    and status = 'pending'
    and expires_at > now()
  returning * into v_invitation;

  if not found then
    raise exception 'This invitation is invalid, expired, or has already been used';
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

-- ---------------------------------------------------------------------
-- 9. get_invitation_preview(): the ONLY thing an unauthenticated
--    visitor (or a signed-in visitor who isn't the invitee) can learn
--    from an invitation link, before proving they hold the right
--    account. Deliberately uniform, minimal responses per status so a
--    stale/guessed/revoked token teaches an attacker as little as
--    possible: an unrecognized token returns nothing but 'not_found',
--    and even a legitimately-expired/revoked one only ever reveals the
--    trip's name (never destination, dates, cost, or who's on it).
-- ---------------------------------------------------------------------
create or replace function public.get_invitation_preview(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_token_hash text;
  v_invitation public.trip_invitations;
  v_trip public.trips;
  v_captain_name text;
  v_invitee_name text;
  v_estimated_cost_cents bigint;
begin
  if coalesce(trim(p_token), '') = '' then
    return jsonb_build_object('status', 'not_found');
  end if;

  v_token_hash := encode(extensions.digest(p_token, 'sha256'), 'hex');

  select * into v_invitation from public.trip_invitations where token_hash = v_token_hash;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  select * into v_trip from public.trips where id = v_invitation.trip_id;

  if v_invitation.status = 'revoked' then
    return jsonb_build_object('status', 'revoked', 'trip_name', v_trip.name);
  end if;

  if v_invitation.status = 'declined' then
    return jsonb_build_object('status', 'declined', 'trip_name', v_trip.name);
  end if;

  if v_invitation.status = 'accepted' then
    return jsonb_build_object('status', 'accepted', 'trip_name', v_trip.name, 'trip_id', v_trip.id);
  end if;

  if v_invitation.expires_at <= now() then
    return jsonb_build_object('status', 'expired', 'trip_name', v_trip.name);
  end if;

  select display_name into v_invitee_name
  from public.trip_members
  where trip_id = v_invitation.trip_id and lower(email) = lower(v_invitation.email) and status = 'invited'
  limit 1;

  select display_name into v_captain_name
  from public.trip_members
  where trip_id = v_invitation.trip_id and role = 'captain' and status = 'active'
  order by created_at asc
  limit 1;

  select round(coalesce(sum(e.total_amount_cents), 0)::numeric / greatest((
    select count(*) from public.trip_members where trip_id = v_trip.id and status = 'active'
  ), 1))::bigint
  into v_estimated_cost_cents
  from public.expenses e
  where e.trip_id = v_trip.id;

  return jsonb_build_object(
    'status', 'pending',
    'trip_id', v_trip.id,
    'trip_name', v_trip.name,
    'destination', v_trip.destination,
    'start_date', v_trip.start_date,
    'end_date', v_trip.end_date,
    'captain_name', coalesce(v_captain_name, 'The trip captain'),
    'invitee_name', coalesce(v_invitee_name, 'there'),
    'invitee_email', v_invitation.email,
    'estimated_cost_cents', coalesce(v_estimated_cost_cents, 0)
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 10. transfer_trip_ownership(): owner-only, explicit — the "explicit
--     confirmation" the spec asks for is enforced by the client
--     (a typed confirmation before the request is even sent), but the
--     server independently re-checks that the caller IS the current
--     owner regardless of what the client claims.
-- ---------------------------------------------------------------------
create or replace function public.transfer_trip_ownership(
  p_trip_id uuid,
  p_new_owner_trip_member_id uuid
)
returns public.trips
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trip public.trips;
  v_new_owner public.trip_members;
begin
  select * into v_trip from public.trips where id = p_trip_id;
  if not found then
    raise exception 'Trip not found';
  end if;

  if v_trip.owner_id is distinct from auth.uid() then
    raise exception 'Only the current trip owner can transfer ownership';
  end if;

  select * into v_new_owner
  from public.trip_members
  where id = p_new_owner_trip_member_id and trip_id = p_trip_id;

  if not found or v_new_owner.status <> 'active' or v_new_owner.user_id is null then
    raise exception 'The new owner must be an active golfer with an account on this trip';
  end if;

  if v_new_owner.role <> 'captain' then
    update public.trip_members set role = 'captain' where id = v_new_owner.id;
  end if;

  update public.trips set owner_id = v_new_owner.user_id, updated_at = now()
  where id = p_trip_id
  returning * into v_trip;

  insert into public.activity_log (trip_id, actor_user_id, event_type, event_data)
  values (
    p_trip_id, auth.uid(), 'ownership_transferred',
    jsonb_build_object('new_owner_trip_member_id', v_new_owner.id, 'new_owner_name', v_new_owner.display_name)
  );

  return v_trip;
end;
$$;

-- ---------------------------------------------------------------------
-- 11. confirm_payment / reject_payment: now also allow the payment's
--     designated recipient, not only a captain — e.g. if Mike paid
--     Chris directly, Chris should be able to confirm receipt even if
--     Chris isn't a co-treasurer. A member who is neither the trip's
--     captain nor this specific payment's recipient is still rejected.
-- ---------------------------------------------------------------------
create or replace function public.confirm_payment(p_payment_id uuid)
returns public.payments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payments;
  v_authorized boolean;
begin
  select * into v_payment from public.payments where id = p_payment_id;
  if not found then
    raise exception 'Payment not found';
  end if;

  v_authorized := public.is_trip_captain(v_payment.trip_id) or exists (
    select 1 from public.trip_members
    where id = v_payment.recipient_member_id
      and user_id = auth.uid()
      and status = 'active'
  );

  if not v_authorized then
    raise exception 'Only a trip captain or this payment''s recipient can confirm it';
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

create or replace function public.reject_payment(p_payment_id uuid, p_reason text default null)
returns public.payments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payments;
  v_authorized boolean;
begin
  select * into v_payment from public.payments where id = p_payment_id;
  if not found then
    raise exception 'Payment not found';
  end if;

  v_authorized := public.is_trip_captain(v_payment.trip_id) or exists (
    select 1 from public.trip_members
    where id = v_payment.recipient_member_id
      and user_id = auth.uid()
      and status = 'active'
  );

  if not v_authorized then
    raise exception 'Only a trip captain or this payment''s recipient can reject it';
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

-- ---------------------------------------------------------------------
-- 12. log_reminder_sent(): captain-only, rate-limited record of a
--     reminder being sent (by whatever channel) — the reminder center
--     calls this alongside/instead of actually emailing.
-- ---------------------------------------------------------------------
create or replace function public.log_reminder_sent(
  p_trip_id uuid,
  p_kind text,
  p_tone text,
  p_channel text,
  p_target_member_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_trip_captain(p_trip_id) then
    raise exception 'Only a trip captain can send reminders';
  end if;

  perform public.enforce_rate_limit(p_trip_id, 'reminder_sent', interval '1 hour', 15);

  insert into public.activity_log (trip_id, actor_user_id, event_type, event_data)
  values (
    p_trip_id, auth.uid(), 'reminder_sent',
    jsonb_build_object('kind', p_kind, 'tone', p_tone, 'channel', p_channel, 'target_member_id', p_target_member_id)
  );
end;
$$;

-- ---------------------------------------------------------------------
-- Grants. Same two-revoke pattern used throughout this project: a
-- fresh CREATE FUNCTION picks up both Postgres's own PUBLIC grant and
-- Supabase's automatic anon/authenticated grants, and both must be
-- revoked from anon explicitly or the is_trip_captain()/owner checks
-- inside these functions become the only thing standing between an
-- anonymous caller and a captain-only action. get_invitation_preview()
-- is the deliberate exception — it MUST be callable by anon, since an
-- invited golfer hasn't signed in yet when they open the link.
-- ---------------------------------------------------------------------
revoke execute on function public.create_trip(text, text, date, date, text, text) from public;
revoke execute on function public.create_trip(text, text, date, date, text, text) from anon;
grant execute on function public.create_trip(text, text, date, date, text, text) to authenticated;

revoke execute on function public.invite_trip_member(uuid, text, text, public.member_role) from public;
revoke execute on function public.invite_trip_member(uuid, text, text, public.member_role) from anon;
grant execute on function public.invite_trip_member(uuid, text, text, public.member_role) to authenticated;

revoke execute on function public.resend_trip_invitation(uuid) from public;
revoke execute on function public.resend_trip_invitation(uuid) from anon;
grant execute on function public.resend_trip_invitation(uuid) to authenticated;

revoke execute on function public.revoke_trip_invitation(uuid) from public;
revoke execute on function public.revoke_trip_invitation(uuid) from anon;
grant execute on function public.revoke_trip_invitation(uuid) to authenticated;

revoke execute on function public.accept_trip_invitation(text) from public;
revoke execute on function public.accept_trip_invitation(text) from anon;
grant execute on function public.accept_trip_invitation(text) to authenticated;

revoke execute on function public.decline_trip_invitation(text) from public;
grant execute on function public.decline_trip_invitation(text) to anon, authenticated;

revoke execute on function public.get_invitation_preview(text) from public;
grant execute on function public.get_invitation_preview(text) to anon, authenticated;

revoke execute on function public.transfer_trip_ownership(uuid, uuid) from public;
revoke execute on function public.transfer_trip_ownership(uuid, uuid) from anon;
grant execute on function public.transfer_trip_ownership(uuid, uuid) to authenticated;

revoke execute on function public.confirm_payment(uuid) from public;
revoke execute on function public.confirm_payment(uuid) from anon;
grant execute on function public.confirm_payment(uuid) to authenticated;

revoke execute on function public.reject_payment(uuid, text) from public;
revoke execute on function public.reject_payment(uuid, text) from anon;
grant execute on function public.reject_payment(uuid, text) to authenticated;

revoke execute on function public.log_reminder_sent(uuid, text, text, text, uuid) from public;
revoke execute on function public.log_reminder_sent(uuid, text, text, text, uuid) from anon;
grant execute on function public.log_reminder_sent(uuid, text, text, text, uuid) to authenticated;

do $$
declare
  v_anon_funcs text[] := array[
    'public.create_trip(text, text, date, date, text, text)',
    'public.invite_trip_member(uuid, text, text, public.member_role)',
    'public.resend_trip_invitation(uuid)',
    'public.revoke_trip_invitation(uuid)',
    'public.accept_trip_invitation(text)',
    'public.transfer_trip_ownership(uuid, uuid)',
    'public.confirm_payment(uuid)',
    'public.reject_payment(uuid, text)',
    'public.log_reminder_sent(uuid, text, text, text, uuid)'
  ];
  v_authenticated_funcs text[] := v_anon_funcs || array[
    'public.decline_trip_invitation(text)',
    'public.get_invitation_preview(text)'
  ];
  v_fn text;
begin
  foreach v_fn in array v_anon_funcs loop
    if has_function_privilege('anon', v_fn, 'execute') then
      raise exception 'anon must not be able to execute %', v_fn;
    end if;
  end loop;

  foreach v_fn in array v_authenticated_funcs loop
    if not has_function_privilege('authenticated', v_fn, 'execute') then
      raise exception 'authenticated must be able to execute %', v_fn;
    end if;
  end loop;

  if not has_function_privilege('anon', 'public.get_invitation_preview(text)', 'execute') then
    raise exception 'anon must be able to execute get_invitation_preview (invited golfers are not signed in yet)';
  end if;

  if not has_function_privilege('anon', 'public.decline_trip_invitation(text)', 'execute') then
    raise exception 'anon must be able to execute decline_trip_invitation (declining does not require an account)';
  end if;
end $$;
