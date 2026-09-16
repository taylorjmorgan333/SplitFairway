-- Course Handicap / Playing Handicap support.
--
-- Root cause this migration is part of fixing: round setup already
-- snapshots a golfer's profile Handicap Index onto round_players
-- (profile_handicap_index/profile_handicap_source/
-- profile_handicap_revision_date, added in 20260903040000_rounds.sql),
-- but nothing ever converted that Handicap Index into a tee-specific
-- Course Handicap using the tee's Rating/Slope/Par (WHS formula:
-- Course Handicap = Index x (Slope/113) + (Rating - Par)) -- the raw
-- profile Handicap Index was being written straight into
-- round_players.playing_handicap instead (see
-- addRoundPlayerAction/updateRoundPlayerAction/addNewGolferToRoundAction
-- in src/actions/rounds.ts, and accept_group_invitation() in
-- 20260916160000_group_invitation_access_fixes.sql). This migration adds
-- the columns needed to store the calculated Course Handicap alongside
-- the existing Playing Handicap, and to distinguish a calculated value
-- from a deliberate manual override from a pre-this-fix legacy value --
-- it does not itself change any stored playing_handicap number.
--
-- Deliberately reuses existing columns/tables rather than adding
-- parallel ones: round_course_snapshots.tee_sets (jsonb, per
-- 20260903040000_rounds.sql) already carries each tee's course_rating/
-- slope_rating/holes (see src/lib/golf/round-snapshot.ts) -- that is
-- this round's permanent snapshot of the Rating/Slope/Par used, so no
-- new "*_snapshot" columns are added here for that. Similarly
-- round_players.profile_handicap_index is already the golfer's
-- Handicap Index snapshot -- no new "handicap_index_snapshot" column
-- either.

-- 'legacy' exists specifically for every round_players row written
-- before this fix landed: its playing_handicap may be a raw Handicap
-- Index rather than a real Course Handicap, so it must never be
-- silently treated as "calculated" (which would imply it's safe to
-- recompute/replace) nor as "manual" (which would imply a human
-- deliberately chose that exact number as an override). See the
-- backfill below and src/actions/rounds.ts for how each state is used.
create type public.playing_handicap_source as enum ('calculated', 'manual', 'legacy');

alter table public.round_players
  add column course_handicap numeric(4,1),
  add column playing_handicap_source public.playing_handicap_source not null default 'legacy';

comment on column public.round_players.course_handicap is
  'Handicap Index converted for this round''s selected tee via the WHS formula (Course Handicap = Index x (Slope/113) + (Rating-Par), rounded to the nearest whole number) -- see src/lib/golf/handicap.ts#calculateCourseHandicap. Null when the tee''s Rating/Slope/Par were not both available at calculation time; never a fabricated value. Recomputed whenever the tee or the snapshot profile_handicap_index changes, unless playing_handicap_source = ''manual''.';

comment on column public.round_players.playing_handicap_source is
  'calculated = playing_handicap is course_handicap (no game-format handicap allowance exists in this app yet -- see the Final Report). manual = an organizer or the golfer deliberately typed a Playing Handicap override, which a later tee change must never silently discard. legacy = this row predates Course Handicap support entirely; its playing_handicap may just be a raw Handicap Index copied in verbatim and should be treated as unverified until recalculated.';

-- Backfill: every row that already exists predates this feature, so it
-- is unambiguously 'legacy' (the column default already covers new
-- inserts made concurrently with this migration, but existing rows
-- need it set explicitly since the column was just added NOT NULL with
-- that default applied at add-column time by Postgres -- this UPDATE is
-- a no-op in practice but documents the intent and is safe to re-run).
update public.round_players set playing_handicap_source = 'legacy' where playing_handicap_source is distinct from 'legacy';

-- Tracks whether a course_tee_sets row's Rating/Slope came from
-- GolfCourseAPI or was typed in by an organizer/admin (section 5:
-- "Log the source as API or manual", "Clearly identify manually
-- entered values", "Do not overwrite a manual correction during an
-- automatic API refresh without warning"). Null means unknown/legacy --
-- a tee set that existed before this column and has never been
-- re-imported, refreshed, or manually edited since.
alter table public.course_tee_sets
  add column rating_source text check (rating_source is null or rating_source in ('api', 'manual'));

comment on column public.course_tee_sets.rating_source is
  'How course_rating/slope_rating on this row were populated: ''api'' = written by importExternalCourseAction/refreshExternalCourseAction from GolfCourseAPI. ''manual'' = typed in by an organizer/admin (createTeeSetAction or updateTeeSetAction) -- refreshExternalCourseAction must never silently overwrite a ''manual'' row''s Rating/Slope. Null = predates this column (legacy import or never set).';

-- Best-effort backfill for existing rows, so today's already-imported
-- or already-manually-entered tees aren't all stuck at null (which
-- would otherwise make every one of them look "unknown" even though
-- their provenance is obvious from courses.external_source). A row
-- with no Rating/Slope at all stays null either way -- there is
-- nothing to attribute a source to.
update public.course_tee_sets t
set rating_source = 'api'
from public.courses c
where c.id = t.course_id
  and c.external_source is not null
  and t.rating_source is null
  and (t.course_rating is not null or t.slope_rating is not null);

update public.course_tee_sets t
set rating_source = 'manual'
from public.courses c
where c.id = t.course_id
  and c.external_source is null
  and t.rating_source is null
  and (t.course_rating is not null or t.slope_rating is not null);

-- round_course_snapshots has never had an UPDATE policy (only
-- select/insert/delete -- see 20260903040000_rounds.sql), even though
-- the table was granted UPDATE and src/actions/rounds.ts's
-- updateRoundSnapshotAction has called .update() on it since that
-- migration: with no matching policy, RLS silently filters that update
-- to zero rows instead of raising a Postgres error, so that existing
-- "fix a wrong par/yardage/stroke-index directly in this round" feature
-- has been a silent no-op in production. This policy fixes that bug and
-- is also what the new "refresh missing tee data" organizer action
-- (section 4 of the Course/Slope Rating handicap work) needs: allowed
-- while the round hasn't finished (scheduled or in_progress, matching
-- "never touches a completed round"), captain-only, matching the
-- existing insert/delete policies on this table exactly.
create policy "round_course_snapshots_update_captain" on public.round_course_snapshots
  for update to authenticated
  using (exists (
    select 1 from public.rounds r
    where r.id = round_course_snapshots.round_id
      and public.is_trip_captain(r.trip_id)
      and r.status in ('scheduled', 'in_progress')
  ))
  with check (exists (
    select 1 from public.rounds r
    where r.id = round_course_snapshots.round_id
      and public.is_trip_captain(r.trip_id)
      and r.status in ('scheduled', 'in_progress')
  ));

-- Verification, same style as 20260903120000_provider_course_edit_restrictions.sql:
-- re-reads the policy back from the catalog rather than executing DML.
do $$
declare
  v_qual text;
begin
  select qual into v_qual from pg_policies
    where schemaname = 'public' and tablename = 'round_course_snapshots' and policyname = 'round_course_snapshots_update_captain';
  if v_qual is null or v_qual not ilike '%is_trip_captain%' then
    raise exception 'round_course_snapshots_update_captain must guard on is_trip_captain';
  end if;
end $$;
