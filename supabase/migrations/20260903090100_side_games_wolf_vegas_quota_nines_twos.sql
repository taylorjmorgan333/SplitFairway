-- Schema support for wolf, vegas, quota, nines, and twos (the enum
-- values were added in the immediately preceding migration). All five
-- reuse the existing side_games / side_game_participants tables from
-- supabase/migrations/20260903080000_side_games.sql -- same "settings
-- and participants only, scores are read live from hole_scores" design:
--
--   * vegas reuses side_game_participants.side (1/2), exactly like
--     nassau -- two teams, best-ball isn't involved, but the side
--     grouping is identical.
--   * quota, nines, and twos reuse the side-less participant shape
--     skins already uses (every participant scores/settles
--     individually or, for nines, against the field).
--   * wolf is the one format that needs something new: a fixed hitting
--     order (wolf_order, added to side_game_participants below) so the
--     rotating "who's the wolf this hole" can be computed deterministically
--     (src/lib/golf/wolf.ts), plus a small new table (side_game_wolf_picks)
--     to record the one thing that genuinely can't be derived from
--     scores alone -- who the wolf picked as a partner, or that they
--     went it alone, on each hole.
--
-- No new columns on side_games itself: quota always scores gross-vs-par
-- (scoring_metric is set to 'gross' at creation and simply not offered
-- as a choice in that game's UI), and none of the five need a new
-- monetary/settings shape beyond what's already there.

alter table public.side_game_participants
  add column wolf_order smallint check (wolf_order is null or wolf_order between 0 and 3);

comment on column public.side_game_participants.wolf_order is
  'Fixed hitting-order position (0-3) within a wolf game, used to compute whose turn it is to be wolf on a given hole ((hole_number - 1) % 4). Null for every other game type.';

-- One golfer can''t hold two hitting-order slots (or the same slot
-- twice) in the same wolf game.
create unique index side_game_participants_wolf_order_unique
  on public.side_game_participants (side_game_id, wolf_order)
  where wolf_order is not null;

create or replace function public.validate_side_game_participant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game_round_id uuid;
  v_game_type public.side_game_type;
  v_player_round_id uuid;
begin
  select round_id, game_type into v_game_round_id, v_game_type
  from public.side_games where id = new.side_game_id;

  select round_id into v_player_round_id
  from public.round_players where id = new.round_player_id;

  if v_game_round_id is null or v_player_round_id is null or v_game_round_id != v_player_round_id then
    raise exception 'side_game_participants.round_player_id must belong to the same round as side_game_id';
  end if;

  if v_game_type in ('nassau', 'vegas') and new.side is null then
    raise exception 'a % participant must have a side (1 or 2)', v_game_type;
  end if;

  if v_game_type not in ('nassau', 'vegas') and new.side is not null then
    raise exception 'a % participant must not have a side', v_game_type;
  end if;

  if v_game_type = 'wolf' and new.wolf_order is null then
    raise exception 'a wolf participant must have a wolf_order (0-3)';
  end if;

  if v_game_type != 'wolf' and new.wolf_order is not null then
    raise exception 'wolf_order only applies to wolf games';
  end if;

  return new;
end;
$$;

create table public.side_game_wolf_picks (
  id uuid primary key default gen_random_uuid(),
  side_game_id uuid not null references public.side_games(id) on delete cascade,
  hole_number smallint not null check (hole_number between 1 and 18),
  -- Null exactly when is_lone_wolf is true -- the wolf either picks one
  -- of the other three as a partner (2v2 that hole) or goes alone.
  partner_round_player_id uuid references public.round_players(id) on delete cascade,
  is_lone_wolf boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint side_game_wolf_picks_unique unique (side_game_id, hole_number),
  constraint side_game_wolf_picks_partner_or_lone check (
    (is_lone_wolf = true and partner_round_player_id is null)
    or (is_lone_wolf = false and partner_round_player_id is not null)
  )
);
create index side_game_wolf_picks_side_game_id_idx on public.side_game_wolf_picks (side_game_id);

comment on table public.side_game_wolf_picks is
  'One row per hole of a wolf game, recording only what can''t be derived from hole_scores: the wolf''s partner pick (or that they went lone wolf). A hole with no row yet simply hasn''t been decided.';

create or replace function public.validate_side_game_wolf_pick()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game_type public.side_game_type;
  v_wolf_round_player_id uuid;
begin
  select game_type into v_game_type from public.side_games where id = new.side_game_id;
  if v_game_type is null then
    raise exception 'side_game_wolf_picks.side_game_id must reference an existing side game';
  end if;
  if v_game_type != 'wolf' then
    raise exception 'wolf picks only apply to wolf games';
  end if;

  select round_player_id into v_wolf_round_player_id
  from public.side_game_participants
  where side_game_id = new.side_game_id
    and wolf_order = mod(new.hole_number - 1, 4);

  if new.partner_round_player_id is not null then
    if new.partner_round_player_id = v_wolf_round_player_id then
      raise exception 'the wolf cannot pick themselves as partner';
    end if;
    if not exists (
      select 1 from public.side_game_participants
      where side_game_id = new.side_game_id and round_player_id = new.partner_round_player_id
    ) then
      raise exception 'wolf pick partner must be a participant in this game';
    end if;
  end if;

  return new;
end;
$$;

create trigger trg_validate_side_game_wolf_pick
  before insert or update on public.side_game_wolf_picks
  for each row execute function public.validate_side_game_wolf_pick();

alter table public.side_game_wolf_picks enable row level security;
revoke all on public.side_game_wolf_picks from anon;
grant select, insert, update, delete on public.side_game_wolf_picks to authenticated;

create policy "side_game_wolf_picks_select_members" on public.side_game_wolf_picks
  for select to authenticated
  using (exists (
    select 1 from public.side_games sg
    join public.rounds r on r.id = sg.round_id
    where sg.id = side_game_wolf_picks.side_game_id and public.is_trip_member(r.trip_id)
  ));

-- Same reasoning as side_game_presses: recording who the wolf picked is
-- low-risk (it can't rewrite anyone's score, only this one small pick),
-- so it's open to the captain or any golfer actually in the game, not
-- captain-only.
create policy "side_game_wolf_picks_insert_captain_or_participant" on public.side_game_wolf_picks
  for insert to authenticated
  with check (
    exists (
      select 1 from public.side_games sg
      join public.rounds r on r.id = sg.round_id
      where sg.id = side_game_wolf_picks.side_game_id and public.is_trip_captain(r.trip_id)
    )
    or exists (
      select 1 from public.side_game_participants sgp
      join public.round_players rp on rp.id = sgp.round_player_id
      join public.trip_members tm on tm.id = rp.trip_member_id
      where sgp.side_game_id = side_game_wolf_picks.side_game_id and tm.user_id = auth.uid()
    )
  );

create policy "side_game_wolf_picks_update_captain_or_participant" on public.side_game_wolf_picks
  for update to authenticated
  using (
    exists (
      select 1 from public.side_games sg
      join public.rounds r on r.id = sg.round_id
      where sg.id = side_game_wolf_picks.side_game_id and public.is_trip_captain(r.trip_id)
    )
    or exists (
      select 1 from public.side_game_participants sgp
      join public.round_players rp on rp.id = sgp.round_player_id
      join public.trip_members tm on tm.id = rp.trip_member_id
      where sgp.side_game_id = side_game_wolf_picks.side_game_id and tm.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.side_games sg
      join public.rounds r on r.id = sg.round_id
      where sg.id = side_game_wolf_picks.side_game_id and public.is_trip_captain(r.trip_id)
    )
    or exists (
      select 1 from public.side_game_participants sgp
      join public.round_players rp on rp.id = sgp.round_player_id
      join public.trip_members tm on tm.id = rp.trip_member_id
      where sgp.side_game_id = side_game_wolf_picks.side_game_id and tm.user_id = auth.uid()
    )
  );

create policy "side_game_wolf_picks_delete_captain" on public.side_game_wolf_picks
  for delete to authenticated
  using (exists (
    select 1 from public.side_games sg
    join public.rounds r on r.id = sg.round_id
    where sg.id = side_game_wolf_picks.side_game_id and public.is_trip_captain(r.trip_id)
  ));

do $$
begin
  if has_table_privilege('anon', 'public.side_game_wolf_picks', 'select') then
    raise exception 'anon must not have any grant on side_game_wolf_picks';
  end if;
end $$;
