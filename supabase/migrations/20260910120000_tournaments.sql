-- Tournaments: a named event on a trip that groups multiple tee times
-- (rounds) together -- e.g. a "Saturday Scramble" with three separate
-- tee times at 7:40/7:50/8:00. Purely organizational: a tournament has
-- no scoring or games of its own, only rounds.tournament_id pointing
-- back to it. Nullable, so a standalone tee time with no tournament
-- keeps working exactly as it always has.

create table public.tournaments (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  name text not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tournaments_trip_id_idx on public.tournaments (trip_id);

comment on table public.tournaments is
  'A named event on a trip that can group multiple tee times (rounds) together. No scoring or games of its own -- rounds.tournament_id is the only link back to it.';

alter table public.rounds
  add column tournament_id uuid references public.tournaments(id) on delete set null;
create index rounds_tournament_id_idx on public.rounds (tournament_id);

create trigger trg_tournaments_updated_at
  before update on public.tournaments
  for each row execute function public.set_updated_at();

-- A round's tournament_id, if set, must belong to the same trip as the
-- round itself -- same cross-table guard shape as
-- validate_round_player_trip() for round_players.trip_member_id.
create or replace function public.validate_round_tournament_trip()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tournament_trip_id uuid;
begin
  if new.tournament_id is null then
    return new;
  end if;

  select trip_id into v_tournament_trip_id from public.tournaments where id = new.tournament_id;

  if v_tournament_trip_id is null or v_tournament_trip_id != new.trip_id then
    raise exception 'rounds.tournament_id must belong to the same trip as rounds.trip_id';
  end if;

  return new;
end;
$$;

create trigger trg_validate_round_tournament_trip
  before insert or update on public.rounds
  for each row execute function public.validate_round_tournament_trip();

alter table public.tournaments enable row level security;
revoke all on public.tournaments from anon;
grant select, insert, update, delete on public.tournaments to authenticated;

-- Same visibility/edit rights as rounds: any trip member can see a
-- trip's tournaments, only the captain can create, edit, or delete one.
create policy "tournaments_select_members" on public.tournaments
  for select to authenticated
  using (public.is_trip_member(trip_id));

create policy "tournaments_insert_captain" on public.tournaments
  for insert to authenticated
  with check (public.is_trip_captain(trip_id));

create policy "tournaments_update_captain" on public.tournaments
  for update to authenticated
  using (public.is_trip_captain(trip_id))
  with check (public.is_trip_captain(trip_id));

create policy "tournaments_delete_captain" on public.tournaments
  for delete to authenticated
  using (public.is_trip_captain(trip_id));

do $$
begin
  if has_table_privilege('anon', 'public.tournaments', 'select') then
    raise exception 'anon must not have any grant on tournaments';
  end if;
end $$;
