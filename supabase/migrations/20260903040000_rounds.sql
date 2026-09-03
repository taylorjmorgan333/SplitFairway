-- Round creation (phase 5). A round belongs to a trip and a course; it
-- captures a snapshot of the course's tee sets and hole-by-hole
-- par/yardage/stroke-index at the moment the round is set up, so a
-- later edit to the course (courses/course_tee_sets/course_holes) never
-- changes a round that already exists — the requirement that a round's
-- scoring stays stable even if the shared course library is corrected
-- afterward. Participants are drawn from the trip's existing
-- trip_members (already the app's "golfer with or without an account"
-- concept — a guest with no user_id can later accept an invitation and
-- claim their own history, exactly the "guest who can later claim their
-- player profile" requirement), so round authorization can reuse the
-- existing is_trip_member()/is_trip_captain() helpers rather than
-- inventing a parallel membership system.

create type public.round_status as enum ('scheduled', 'in_progress', 'completed', 'locked');
create type public.round_score_edit_scope as enum ('per_golfer', 'per_group');

create table public.rounds (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  course_id uuid references public.courses(id) on delete set null,
  name text,
  round_date date not null,
  start_time time,
  hole_count smallint not null check (hole_count in (9, 18)),
  status public.round_status not null default 'scheduled',
  -- Whether every golfer's live scores are visible to the whole round
  -- (leaderboard-style) or kept private until the round is locked.
  live_score_visibility boolean not null default true,
  -- Whether any golfer can edit any score in their round, or only
  -- scores for their own group (see round_groups). Enforced by the
  -- score-entry actions built in phase 6/7, not by this table alone.
  score_edit_scope public.round_score_edit_scope not null default 'per_golfer',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index rounds_trip_id_idx on public.rounds (trip_id);
create index rounds_course_id_idx on public.rounds (course_id);

comment on table public.rounds is
  'A scheduled or played round of golf on one trip. course_id is a soft reference only (on delete set null) — round_course_snapshots is the durable record of what the round was actually played on, since course_id alone would go stale the moment anyone edits the shared course library.';

create table public.round_course_snapshots (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null unique references public.rounds(id) on delete cascade,
  course_name text not null,
  course_city text,
  course_state text,
  hole_count smallint not null,
  -- [{ name, holes: [{ hole_number, par, yardage, stroke_index }] }] —
  -- one entry per tee set that existed on the course at round-creation
  -- time. Denormalized into JSON rather than mirrored into normalized
  -- snapshot tables: it's written exactly once (by create_round_action,
  -- immediately after the course/tee lookup that built the round-setup
  -- form), never queried piecemeal, and this keeps phase 5 from having
  -- to duplicate course_tee_sets/course_holes as two more tables.
  tee_sets jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.round_course_snapshots is
  'Immutable copy of the course/tee/hole data a round was set up with. Written once, at round creation, by the same action that creates the round row — never updated afterward, and never re-derived from the live courses/course_tee_sets/course_holes tables once a round exists.';

create table public.round_groups (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds(id) on delete cascade,
  label text not null default 'Group 1',
  starting_hole smallint not null default 1 check (starting_hole between 1 and 18),
  sort_order smallint not null default 0,
  created_at timestamptz not null default now()
);
create index round_groups_round_id_idx on public.round_groups (round_id);

create table public.round_players (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds(id) on delete cascade,
  trip_member_id uuid not null references public.trip_members(id) on delete cascade,
  group_id uuid references public.round_groups(id) on delete set null,
  -- Matches a tee_sets[].name entry in this round's
  -- round_course_snapshots row — stored as plain text, not a foreign
  -- key, since the snapshot itself is JSON and may reference a tee set
  -- that no longer exists in course_tee_sets by the time anyone reads
  -- it back.
  tee_set_name text,
  -- Handicap snapshot, captured once when the golfer is added to the
  -- round (see the migration-level comment above and
  -- src/actions/rounds.ts#addRoundPlayerAction) — never rewritten by a
  -- later golf_profiles update, so a completed round's results stay
  -- fixed even if the golfer updates their handicap afterward.
  profile_handicap_index numeric(4,1),
  profile_handicap_source public.handicap_source,
  profile_handicap_revision_date date,
  -- The handicap actually used for this round — defaults to the
  -- profile snapshot above but is independently editable, since the
  -- organizer or the golfer may adjust it (course handicap conversion,
  -- a agreed-upon adjustment, etc.) without that being confused for a
  -- change to their profile handicap.
  playing_handicap numeric(4,1),
  handicap_entered_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint round_players_unique_member unique (round_id, trip_member_id)
);
create index round_players_round_id_idx on public.round_players (round_id);
create index round_players_group_id_idx on public.round_players (group_id);
create index round_players_trip_member_id_idx on public.round_players (trip_member_id);

comment on table public.round_players is
  'One row per golfer entered into a round. trip_member_id (not a bare user_id) is what lets a guest with no account play in and appear in a round -- the same trip_members row they would later claim via a trip invitation.';

-- A round_player's trip_member must actually belong to the round's own
-- trip -- a plain foreign key can't express that cross-table equality,
-- so it's enforced here instead of trusting every calling action to
-- check it correctly.
create or replace function public.validate_round_player_trip()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_round_trip_id uuid;
  v_member_trip_id uuid;
begin
  select trip_id into v_round_trip_id from public.rounds where id = new.round_id;
  select trip_id into v_member_trip_id from public.trip_members where id = new.trip_member_id;

  if v_round_trip_id is null or v_member_trip_id is null or v_round_trip_id != v_member_trip_id then
    raise exception 'round_players.trip_member_id must belong to the same trip as round_players.round_id';
  end if;

  return new;
end;
$$;

create trigger trg_validate_round_player_trip
  before insert or update on public.round_players
  for each row execute function public.validate_round_player_trip();

create trigger trg_rounds_updated_at
  before update on public.rounds
  for each row execute function public.set_updated_at();

alter table public.rounds enable row level security;
alter table public.round_course_snapshots enable row level security;
alter table public.round_groups enable row level security;
alter table public.round_players enable row level security;

revoke all on public.rounds from anon;
revoke all on public.round_course_snapshots from anon;
revoke all on public.round_groups from anon;
revoke all on public.round_players from anon;

grant select, insert, update, delete on public.rounds to authenticated;
grant select, insert, update, delete on public.round_course_snapshots to authenticated;
grant select, insert, update, delete on public.round_groups to authenticated;
grant select, insert, update, delete on public.round_players to authenticated;

-- rounds: any trip member can see a trip's rounds; only the trip's
-- captain (the "organizer" role this app already has) can create,
-- edit, or delete one -- reusing is_trip_member/is_trip_captain from
-- earlier migrations rather than inventing round-specific roles.
create policy "rounds_select_members" on public.rounds
  for select to authenticated
  using (public.is_trip_member(trip_id));

create policy "rounds_insert_captain" on public.rounds
  for insert to authenticated
  with check (public.is_trip_captain(trip_id));

create policy "rounds_update_captain" on public.rounds
  for update to authenticated
  using (public.is_trip_captain(trip_id))
  with check (public.is_trip_captain(trip_id));

create policy "rounds_delete_captain" on public.rounds
  for delete to authenticated
  using (public.is_trip_captain(trip_id));

-- round_course_snapshots / round_groups / round_players: same
-- visibility and edit rights as their parent round, checked through
-- it. A delete policy is required on every one of these even though no
-- UI ever deletes them directly -- deleting a round cascades to all
-- three, and a cascading delete is still subject to each child table's
-- own RLS delete policy, not just the parent's.
create policy "round_course_snapshots_select_members" on public.round_course_snapshots
  for select to authenticated
  using (exists (
    select 1 from public.rounds r where r.id = round_course_snapshots.round_id and public.is_trip_member(r.trip_id)
  ));

create policy "round_course_snapshots_insert_captain" on public.round_course_snapshots
  for insert to authenticated
  with check (exists (
    select 1 from public.rounds r where r.id = round_course_snapshots.round_id and public.is_trip_captain(r.trip_id)
  ));

create policy "round_course_snapshots_delete_captain" on public.round_course_snapshots
  for delete to authenticated
  using (exists (
    select 1 from public.rounds r where r.id = round_course_snapshots.round_id and public.is_trip_captain(r.trip_id)
  ));

create policy "round_groups_select_members" on public.round_groups
  for select to authenticated
  using (exists (
    select 1 from public.rounds r where r.id = round_groups.round_id and public.is_trip_member(r.trip_id)
  ));

create policy "round_groups_write_captain" on public.round_groups
  for insert to authenticated
  with check (exists (
    select 1 from public.rounds r where r.id = round_groups.round_id and public.is_trip_captain(r.trip_id)
  ));

create policy "round_groups_update_captain" on public.round_groups
  for update to authenticated
  using (exists (
    select 1 from public.rounds r where r.id = round_groups.round_id and public.is_trip_captain(r.trip_id)
  ))
  with check (exists (
    select 1 from public.rounds r where r.id = round_groups.round_id and public.is_trip_captain(r.trip_id)
  ));

create policy "round_groups_delete_captain" on public.round_groups
  for delete to authenticated
  using (exists (
    select 1 from public.rounds r where r.id = round_groups.round_id and public.is_trip_captain(r.trip_id)
  ));

create policy "round_players_select_members" on public.round_players
  for select to authenticated
  using (exists (
    select 1 from public.rounds r where r.id = round_players.round_id and public.is_trip_member(r.trip_id)
  ));

-- Only the organizer builds the roster (adds/removes golfers).
create policy "round_players_insert_captain" on public.round_players
  for insert to authenticated
  with check (exists (
    select 1 from public.rounds r where r.id = round_players.round_id and public.is_trip_captain(r.trip_id)
  ));

create policy "round_players_delete_captain" on public.round_players
  for delete to authenticated
  using (exists (
    select 1 from public.rounds r where r.id = round_players.round_id and public.is_trip_captain(r.trip_id)
  ));

-- Updating a round_player row (tee set, group, playing handicap) is
-- allowed for the organizer OR the golfer themselves, per "organizer or
-- golfer can enter the playing handicap used for a round." RLS can only
-- gate the whole row, not individual columns, so a golfer editing their
-- own row could technically also change their own tee_set_name or
-- group_id -- an acceptable, non-escalating gap (it only affects their
-- own participation in a round they're already part of), the same kind
-- of tradeoff already made for courses.status in the previous migration.
create policy "round_players_update_captain_or_self" on public.round_players
  for update to authenticated
  using (
    exists (select 1 from public.rounds r where r.id = round_players.round_id and public.is_trip_captain(r.trip_id))
    or exists (
      select 1 from public.trip_members tm
      where tm.id = round_players.trip_member_id and tm.user_id = auth.uid()
    )
  )
  with check (
    exists (select 1 from public.rounds r where r.id = round_players.round_id and public.is_trip_captain(r.trip_id))
    or exists (
      select 1 from public.trip_members tm
      where tm.id = round_players.trip_member_id and tm.user_id = auth.uid()
    )
  );

do $$
begin
  if has_table_privilege('anon', 'public.rounds', 'select') then
    raise exception 'anon must not have any grant on rounds';
  end if;
  if has_table_privilege('anon', 'public.round_course_snapshots', 'select') then
    raise exception 'anon must not have any grant on round_course_snapshots';
  end if;
  if has_table_privilege('anon', 'public.round_groups', 'select') then
    raise exception 'anon must not have any grant on round_groups';
  end if;
  if has_table_privilege('anon', 'public.round_players', 'select') then
    raise exception 'anon must not have any grant on round_players';
  end if;
end $$;
