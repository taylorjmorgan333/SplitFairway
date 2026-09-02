-- updated_at helper
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger trg_trips_updated_at before update on public.trips for each row execute function public.set_updated_at();
create trigger trg_expenses_updated_at before update on public.expenses for each row execute function public.set_updated_at();

-- profile auto-creation on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- membership helper functions (security definer to avoid RLS recursion)
create or replace function public.is_trip_member(p_trip_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.trip_members
    where trip_id = p_trip_id
      and user_id = auth.uid()
      and status = 'active'
  );
$$;

create or replace function public.is_trip_captain(p_trip_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.trip_members
    where trip_id = p_trip_id
      and user_id = auth.uid()
      and status = 'active'
      and role = 'captain'
  );
$$;

create or replace function public.shares_active_trip_with(p_other_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.trip_members tm_self
    join public.trip_members tm_other on tm_other.trip_id = tm_self.trip_id
    where tm_self.user_id = auth.uid()
      and tm_self.status = 'active'
      and tm_other.user_id = p_other_user_id
      and tm_other.status = 'active'
  );
$$;

-- guard against a trip ever having zero active captains
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

create trigger trg_prevent_removing_last_captain
before update or delete on public.trip_members
for each row execute function public.prevent_removing_last_captain();
