-- Each golfer's own "how to pay me" info -- a preferred payment app plus
-- their handle/username on it (e.g. Venmo @taylor-morgan), so trip mates
-- know where to send money without asking. Purely informational: it
-- never touches payments.payment_method, which records how a specific
-- payment was actually made. Nullable, so nothing here is required and
-- every existing golfer keeps working exactly as before.

alter table public.trip_members
  add column preferred_payment_method public.payment_method,
  add column payment_handle text;

alter table public.trip_members
  add constraint trip_members_payment_handle_length check (char_length(payment_handle) <= 120);

-- A captain often adds a golfer manually before they've ever signed in
-- (see add_trip_member_manually), so the captain needs to be able to
-- set this on a golfer's behalf; a signed-in golfer should always be
-- able to keep their own info current without waiting on the captain.
-- Either is allowed here; nobody else.
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

  if not (public.is_trip_captain(v_member.trip_id) or v_member.user_id = auth.uid()) then
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

grant execute on function public.set_trip_member_payment_info(uuid, public.payment_method, text) to authenticated;
