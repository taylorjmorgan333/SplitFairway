-- Lets a captain add a golfer directly as an active trip member,
-- bypassing the email-invitation flow entirely. Aimed at golfers who
-- won't check an inbox (or don't want to give an email at all) — the
-- captain types a name, the golfer is immediately 'active' and can be
-- scored, added to rounds/games, and included in expense splits, the
-- same as anyone who accepted a real invite. email becomes optional to
-- support this: every existing invite/reminder function already keys
-- off is-not-null email lookups (case-insensitive equality against a
-- non-null argument, or an explicit `?? ""` fallback), so a null value
-- here is inert everywhere else in the schema.
alter table public.trip_members alter column email drop not null;

create or replace function public.add_trip_member_manually(
  p_trip_id uuid,
  p_display_name text,
  p_email text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member public.trip_members;
  v_email text := nullif(lower(trim(coalesce(p_email, ''))), '');
begin
  if not public.is_trip_captain(p_trip_id) then
    raise exception 'Only a trip captain can add a golfer';
  end if;

  perform public.enforce_rate_limit(p_trip_id, 'member_added_manually', interval '1 hour', 40);

  if v_email is not null and exists (
    select 1 from public.trip_members
    where trip_id = p_trip_id and lower(email) = v_email and status in ('invited', 'active')
  ) then
    raise exception 'This email already has an active membership or pending invite for this trip';
  end if;

  insert into public.trip_members (trip_id, user_id, display_name, email, role, status, joined_at)
  values (p_trip_id, null, p_display_name, v_email, 'member', 'active', now())
  returning * into v_member;

  insert into public.activity_log (trip_id, actor_user_id, event_type, event_data)
  values (
    p_trip_id,
    auth.uid(),
    'member_added_manually',
    jsonb_build_object('display_name', p_display_name, 'email', v_email)
  );

  return jsonb_build_object('trip_member_id', v_member.id);
end;
$$;

-- Same two-revoke pattern used throughout this project (see the
-- "Grants" section of 20260902050000_invitations_ownership_reminders.sql):
-- a fresh CREATE FUNCTION picks up Postgres's own PUBLIC grant and
-- Supabase's automatic anon/authenticated grants, and both must be
-- revoked from anon explicitly or the is_trip_captain() check above
-- becomes the only thing standing between an anonymous caller and a
-- captain-only action.
revoke execute on function public.add_trip_member_manually(uuid, text, text) from public;
revoke execute on function public.add_trip_member_manually(uuid, text, text) from anon;
grant execute on function public.add_trip_member_manually(uuid, text, text) to authenticated;

do $$
begin
  if has_function_privilege('anon', 'public.add_trip_member_manually(uuid, text, text)', 'execute') then
    raise exception 'anon must not be able to execute add_trip_member_manually';
  end if;
  if not has_function_privilege('authenticated', 'public.add_trip_member_manually(uuid, text, text)', 'execute') then
    raise exception 'authenticated must be able to execute add_trip_member_manually';
  end if;
end $$;
