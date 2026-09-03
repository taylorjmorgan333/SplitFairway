-- Adds provider attribution to round_course_snapshots (see
-- 20260903040000_rounds.sql) so a round created from a GolfCourseAPI
-- import keeps a permanent record of which provider and which provider
-- course id it came from, alongside the tee/hole data it already
-- snapshots. Both null for a round created from a manually-entered
-- course. This is metadata only -- it plays no part in scoring, which
-- reads tee_sets exactly as before.

alter table public.round_course_snapshots
  add column provider text,
  add column provider_course_id text;

comment on column public.round_course_snapshots.provider is
  'Which course-data provider (e.g. "golfcourseapi") the course was sourced from at round-creation time, copied from courses.external_source. Null for a manually-entered course.';
comment on column public.round_course_snapshots.provider_course_id is
  'The provider''s own id for the course, copied from courses.external_id at round-creation time. Kept even if the course is later refreshed, renamed, or the local courses row is deleted -- this snapshot is this round''s permanent record, independent of the shared course library.';
