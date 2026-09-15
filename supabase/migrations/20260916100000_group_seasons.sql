-- SplitFairway daily-use revamp (Phase 2): Group Seasons.
--
-- A season is just a captain-defined date range a group's rounds get
-- bucketed into for standings purposes -- rounds/side_games/scores are
-- never tagged with a season_id; a round "belongs" to whichever season
-- (if any) its round_date falls inside, computed at query time. This
-- keeps the whole feature purely additive: every existing round from
-- Phase 1 automatically falls into whatever season covers its date
-- (including the implicit calendar-year default computed in code when
-- a group has no custom seasons yet -- see src/lib/golf/group-seasons.ts),
-- with no backfill migration required.
create table public.golf_group_seasons (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.golf_groups(id) on delete cascade,
  name text not null,
  start_date date not null,
  end_date date not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint golf_group_seasons_name_not_blank check (length(trim(name)) > 0),
  constraint golf_group_seasons_date_order check (end_date >= start_date)
);
comment on table public.golf_group_seasons is
  'Captain-defined date ranges used to bucket a group''s rounds for standings (Group Leaderboard "this season" vs "all-time"). A round belongs to a season purely by round_date falling in range -- computed at read time, never stored on the round itself.';

create index golf_group_seasons_group_id_idx on public.golf_group_seasons (group_id, start_date desc);

alter table public.golf_group_seasons enable row level security;

grant select, insert, update, delete on public.golf_group_seasons to authenticated;

create policy "golf_group_seasons_select_members" on public.golf_group_seasons
  for select to authenticated
  using (public.is_group_member(group_id));

create policy "golf_group_seasons_insert_owner" on public.golf_group_seasons
  for insert to authenticated
  with check (public.is_group_owner(group_id));

create policy "golf_group_seasons_update_owner" on public.golf_group_seasons
  for update to authenticated
  using (public.is_group_owner(group_id))
  with check (public.is_group_owner(group_id));

create policy "golf_group_seasons_delete_owner" on public.golf_group_seasons
  for delete to authenticated
  using (public.is_group_owner(group_id));
