-- SplitFairway repositioning (nav/product phase): recurring golf groups
-- ("your regular Saturday foursome"), independent of any one trip. This
-- is a new, additive concept -- it does not touch trips/trip_members/
-- rounds/round_players/hole_scores/expenses or any RLS on them.
--
-- Deliberately named golf_groups (not "groups"): public.round_groups
-- already exists and means something unrelated (the tee-time foursomes
-- within a single round's round_groups/starting_hole setup) -- reusing
-- that name or table for this feature would silently collide with it.

create table public.golf_groups (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references public.profiles(id) on delete set null,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint golf_groups_name_not_blank check (length(trim(name)) > 0)
);
comment on table public.golf_groups is
  'A recurring golf group saved by its members -- a roster of golfers with handicaps/preferred tees, reused across many rounds/trips over time. Independent of any single trip; a trip may optionally reference one via trips.golf_group_id.';

create type public.golf_group_member_role as enum ('owner', 'member');

create table public.golf_group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.golf_groups(id) on delete cascade,
  -- Mirrors trip_members: a saved golfer may or may not have their own
  -- account. A guest golfer (user_id null) can still be added to a
  -- round with a manually-entered handicap, exactly like a manually
  -- added trip member today.
  user_id uuid references public.profiles(id) on delete set null,
  display_name text not null,
  email text,
  role public.golf_group_member_role not null default 'member',
  -- Default only -- never read by scoring itself. A round created from
  -- this group still snapshots its own playing_handicap on round_players
  -- at add-time (see addRoundPlayerAction), same as any other round;
  -- this is just what the "add golfer to round" step is pre-filled
  -- with for a registered user with no golf_profiles row yet, or for a
  -- guest.
  default_handicap_index numeric(4,1),
  preferred_tee_name text,
  created_at timestamptz not null default now(),
  constraint golf_group_members_display_name_not_blank check (length(trim(display_name)) > 0),
  constraint golf_group_members_handicap_range check (
    default_handicap_index is null or (default_handicap_index >= -10.0 and default_handicap_index <= 54.0)
  )
);
comment on table public.golf_group_members is
  'One row per saved golfer in a golf group. default_handicap_index/preferred_tee_name are conveniences that pre-fill round setup -- never read by scoring/handicap calculations themselves, which continue to snapshot playing_handicap on round_players exactly as before this feature existed.';

create unique index golf_group_members_group_user_unique
  on public.golf_group_members (group_id, user_id) where user_id is not null;
create index golf_group_members_group_id_idx on public.golf_group_members (group_id);

-- Saved game configurations a group likes to play, e.g. "$2 Nassau" or
-- "Saturday Wolf". Reuses the existing side_game_type enum so a preset
-- can never drift out of sync with the real set of playable games, and
-- reuses the same free-form settings shape the side-game creation forms
-- already read/write -- this is a saved template for that existing
-- system, not a second one. Applying a preset to a new round's games
-- still goes through the existing side-game creation action; this table
-- only stores what to pre-fill.
create table public.golf_group_game_presets (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.golf_groups(id) on delete cascade,
  name text not null,
  side_game_type public.side_game_type not null,
  settings jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint golf_group_game_presets_name_not_blank check (length(trim(name)) > 0)
);
create index golf_group_game_presets_group_id_idx on public.golf_group_game_presets (group_id);

-- Membership helper functions (security definer to avoid RLS
-- recursion), same pattern as is_trip_member()/is_trip_captain().
create or replace function public.is_group_member(p_group_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.golf_group_members
    where group_id = p_group_id
      and user_id = auth.uid()
  );
$$;

create or replace function public.is_group_owner(p_group_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.golf_group_members
    where group_id = p_group_id
      and user_id = auth.uid()
      and role = 'owner'
  );
$$;

alter table public.golf_groups enable row level security;
alter table public.golf_group_members enable row level security;
alter table public.golf_group_game_presets enable row level security;

grant select, update, delete on public.golf_groups to authenticated;
grant select, insert, update, delete on public.golf_group_members to authenticated;
grant select, insert, update, delete on public.golf_group_game_presets to authenticated;

-- golf_groups (no insert policy: creation goes through create_group(), same
-- pattern as trips/create_trip())
create policy "golf_groups_select_members" on public.golf_groups
  for select to authenticated
  using (public.is_group_member(id));

create policy "golf_groups_update_owner" on public.golf_groups
  for update to authenticated
  using (public.is_group_owner(id))
  with check (public.is_group_owner(id));

create policy "golf_groups_delete_owner" on public.golf_groups
  for delete to authenticated
  using (public.is_group_owner(id));

-- golf_group_members
create policy "golf_group_members_select_members" on public.golf_group_members
  for select to authenticated
  using (public.is_group_member(group_id));

create policy "golf_group_members_insert_owner" on public.golf_group_members
  for insert to authenticated
  with check (public.is_group_owner(group_id));

create policy "golf_group_members_update_owner" on public.golf_group_members
  for update to authenticated
  using (public.is_group_owner(group_id))
  with check (public.is_group_owner(group_id));

create policy "golf_group_members_delete_owner" on public.golf_group_members
  for delete to authenticated
  using (public.is_group_owner(group_id));

-- golf_group_game_presets
create policy "golf_group_game_presets_select_members" on public.golf_group_game_presets
  for select to authenticated
  using (public.is_group_member(group_id));

create policy "golf_group_game_presets_insert_members" on public.golf_group_game_presets
  for insert to authenticated
  with check (public.is_group_member(group_id));

create policy "golf_group_game_presets_update_members" on public.golf_group_game_presets
  for update to authenticated
  using (public.is_group_member(group_id))
  with check (public.is_group_member(group_id));

create policy "golf_group_game_presets_delete_owner" on public.golf_group_game_presets
  for delete to authenticated
  using (public.is_group_owner(group_id));

create trigger golf_groups_set_updated_at
  before update on public.golf_groups
  for each row execute function public.set_updated_at();
