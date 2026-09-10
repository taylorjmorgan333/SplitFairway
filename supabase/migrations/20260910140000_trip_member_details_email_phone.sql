-- Expands the golfer-edit dialog (set_trip_member_payment_info, added
-- moments ago) to cover the other optional contact info the captain
-- asked for: email and phone, alongside the payment app/handle already
-- there. Replaces that narrower function outright rather than keeping
-- two RPCs -- it has no other callers yet, added in this same feature.

alter table public.trip_members
  add column phone text;

alter table public.trip_members
  add constraint trip_members_phone_length check (char_length(phone) <= 40);

drop function if exists public.set_trip_member_payment_info(uuid, public.payment_method, text);

create or replace function public.set_trip_member_details(
  p_trip_member_id uuid,
  p_email text,
  p_phone text,
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
  v_email text := nullif(lower(trim(coalesce(p_email, ''))), '');
  v_phone text := nullif(trim(coalesce(p_phone, '')), '');
  v_handle text := nullif(trim(coalesce(p_payment_handle, '')), '');
begin
  select * into v_member from public.trip_members where id = p_trip_member_id;
  if not found then
    raise exception 'Trip member not found';
  end if;

  -- Same rule as the payment-info-only version this replaces: the
  -- trip's captain, or the golfer themselves, and nobody else. The
  -- null-safe self-check matters because a manually-added golfer's
  -- user_id is null, and `null = null` is null (not true) in SQL, so a
  -- naive `v_member.user_id = auth.uid()` would silently pass for any
  -- signed-in caller when both sides happen to be null.
  if not (
    public.is_trip_captain(v_member.trip_id)
    or (v_member.user_id is not null and v_member.user_id = auth.uid())
  ) then
    raise exception 'Only a trip captain or the golfer themselves can update this info';
  end if;

  if v_phone is not null and char_length(v_phone) > 40 then
    raise exception 'Phone number is too long (max 40 characters)';
  end if;

  if v_handle is not null and char_length(v_handle) > 120 then
    raise exception 'Payment username/handle is too long (max 120 characters)';
  end if;

  -- Mirrors the same duplicate-email guard add_trip_member_manually()
  -- uses, and the partial unique index (uq_trip_members_pending_email)
  -- that actually enforces it -- this just turns that constraint
  -- violation into a friendly message instead of a raw DB error.
  if v_email is not null and exists (
    select 1 from public.trip_members
    where trip_id = v_member.trip_id
      and id <> v_member.id
      and lower(email) = v_email
      and status in ('invited', 'active')
  ) then
    raise exception 'Another golfer on this trip already has that email';
  end if;

  update public.trip_members
  set email = v_email,
      phone = v_phone,
      preferred_payment_method = p_payment_method,
      payment_handle = v_handle
  where id = p_trip_member_id
  returning * into v_member;

  return v_member;
end;
$$;

revoke execute on function public.set_trip_member_details(uuid, text, text, public.payment_method, text) from public;
grant execute on function public.set_trip_member_details(uuid, text, text, public.payment_method, text) to authenticated;
