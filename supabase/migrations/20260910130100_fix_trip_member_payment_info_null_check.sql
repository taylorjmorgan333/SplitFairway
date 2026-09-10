-- Fix a real bug from the previous migration: `v_member.user_id = auth.uid()`
-- is NULL (not false) when v_member.user_id is null -- true for every
-- manually-added golfer, who has no account yet. `not (false or NULL)`
-- is NULL, and `if NULL then` does NOT raise in plpgsql, so the
-- permission check silently fell through and let ANY signed-in user
-- (not just the trip's captain) set payment info on a manually-added
-- member of a trip they may not even belong to. Made the self-check
-- null-safe, and revoked the default PUBLIC/anon execute grant that
-- every function gets unless explicitly revoked, matching the same
-- hardening already applied to the other sensitive RPCs in this app
-- (see revoke_public_execute_on_sensitive_rpcs.sql).
create or replace function public.set_trip_member_payment_info(
  p_trip_member_id uuid,
  p_payment_method public.payment_method,
  p_payment_handle text
)
returns public.trip_members
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member public.trip_members;
  v_handle text := nullif(trim(coalesce(p_payment_handle, '')), '');
begin
  select * into v_member from public.trip_members where id = p_trip_member_id;
  if not found then
    raise exception 'Trip member not found';
  end if;

  if not (
    public.is_trip_captain(v_member.trip_id)
    or (v_member.user_id is not null and v_member.user_id = auth.uid())
  ) then
    raise exception 'Only a trip captain or the golfer themselves can update this payment info';
  end if;

  if v_handle is not null and char_length(v_handle) > 120 then
    raise exception 'Payment username/handle is too long (max 120 characters)';
  end if;

  update public.trip_members
  set preferred_payment_method = p_payment_method,
      payment_handle = v_handle
  where id = p_trip_member_id
  returning * into v_member;

  return v_member;
end;
$$;

revoke execute on function public.set_trip_member_payment_info(uuid, public.payment_method, text) from public;
grant execute on function public.set_trip_member_payment_info(uuid, public.payment_method, text) to authenticated;
