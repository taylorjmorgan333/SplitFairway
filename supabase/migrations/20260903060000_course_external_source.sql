-- Adds optional provenance columns to `courses` so a course imported from
-- a licensed course-data API (GolfCourseAPI, at the user's explicit
-- request — see src/lib/golf/golfcourseapi.ts) can be told apart from one
-- a golfer typed in by hand, and so re-searching/re-importing the same
-- course doesn't create a duplicate row.
--
-- No RLS changes: the existing courses_insert_own policy
-- (supabase/migrations/20260903030000_courses.sql) already only checks
-- created_by = auth.uid() on insert, not status -- the app layer decides
-- whether a newly-inserted course starts 'pending' (manual entry) or
-- 'approved' (imported from a licensed provider, so there's nothing for
-- an admin to review). That's the same accepted app-layer trust boundary
-- already documented on courses_update_own_or_admin.

alter table public.courses
  add column external_source text,
  add column external_id text;

comment on column public.courses.external_source is
  'Which licensed course-data provider this course was imported from (e.g. ''golfcourseapi''), or null for a course a golfer entered by hand.';
comment on column public.courses.external_id is
  'The provider''s own id for this course, used only to avoid importing the same course twice. Meaningful only together with external_source.';

-- Partial + composite so plain manual courses (both columns null) are
-- never compared against each other by this index.
create unique index courses_external_source_id_key
  on public.courses (external_source, external_id)
  where external_source is not null and external_id is not null;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'courses' and column_name = 'external_source'
  ) then
    raise exception 'courses.external_source was not created';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'courses' and column_name = 'external_id'
  ) then
    raise exception 'courses.external_id was not created';
  end if;
  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public' and indexname = 'courses_external_source_id_key'
  ) then
    raise exception 'courses_external_source_id_key index was not created';
  end if;
end $$;
