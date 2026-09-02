-- The last-captain guard was firing even when the entire trip is being
-- deleted (cascade from trips -> trip_members), which made it
-- impossible to ever delete a trip. By the time the cascade delete
-- reaches trip_members, the parent trips row is already gone — so
-- only enforce the check when the trip still exists.
create or replace function public.prevent_removing_last_captain()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trip_id uuid;
  v_remaining_captains int;
begin
  v_trip_id := coalesce(old.trip_id, new.trip_id);

  if not exists (select 1 from public.trips where id = v_trip_id) then
    -- Trip itself is gone (being deleted) — nothing to protect.
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if (tg_op = 'DELETE' and old.role = 'captain' and old.status = 'active')
     or (tg_op = 'UPDATE' and old.role = 'captain' and old.status = 'active'
         and (new.role <> 'captain' or new.status <> 'active')) then
    select count(*) into v_remaining_captains
    from public.trip_members
    where trip_id = v_trip_id
      and role = 'captain'
      and status = 'active'
      and id <> old.id;

    if v_remaining_captains = 0 then
      raise exception 'A trip must always have at least one active captain';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;
