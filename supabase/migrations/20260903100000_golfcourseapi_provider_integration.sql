-- GolfCourseAPI provider integration (phase: course-provider expansion).
--
-- Extends the existing courses/course_tee_sets library (see
-- 20260903030000_courses.sql and 20260903060000_course_external_source.sql)
-- with the concepts a real course-data provider needs, rather than standing
-- up a second, parallel schema: tee-set metadata (color/gender/rating/
-- slope/total yards) that GolfCourseAPI supplies but manual entry never
-- captured, a provider-request usage log for rate-limit tracking and the
-- admin usage dashboard, and a corrections queue so users can flag bad
-- provider data without ever being able to silently overwrite the shared
-- record. courses.external_source/external_id (added in
-- 20260903060000) already carry provider identity, so those are kept as
-- the provider-identity columns rather than duplicated under a new name.

alter table public.courses
  add column last_fetched_at timestamptz;

comment on column public.courses.last_fetched_at is
  'When full course/tee/hole detail was last successfully fetched from external_source for this course. Null for manually-entered courses. Used to decide whether a cached provider course is "fresh enough" to reuse instead of spending another daily request quota on a refetch.';

alter table public.course_tee_sets
  add column color text,
  add column category text check (category is null or category in ('male', 'female', 'unisex')),
  add column course_rating numeric(4,1) check (course_rating is null or course_rating between 50 and 100),
  add column slope_rating smallint check (slope_rating is null or slope_rating between 1 and 200),
  add column total_yards integer check (total_yards is null or total_yards > 0);

comment on column public.course_tee_sets.color is
  'Tee color/marker (e.g. "Blue", "Gold"), when known. GolfCourseAPI does not supply a separate color field on tee boxes -- only a free-text tee_name, which is stored in the existing `name` column -- so this stays null for provider-imported tee sets unless a user or admin fills it in. Populated directly for manually-entered tee sets.';
comment on column public.course_tee_sets.category is
  'Gender grouping the tee set applies to, when known: GolfCourseAPI groups tee boxes under "male"/"female" arrays, which map directly here. Not every course has separate tees per gender -- null means unknown/not specified, not "unisex" by default.';

-- Usage/audit log for every call this app makes to a course-data
-- provider. Backs the free-tier daily-ceiling check (count today's rows),
-- cache-hit/miss reporting, and the admin-only usage dashboard -- never
-- exposed to ordinary users (see RLS below). One row per attempted
-- operation, including ones short-circuited by the daily cap or served
-- entirely from cache, so the admin view can distinguish "we asked the
-- provider and it failed" from "we never asked because the cache had it"
-- from "we never asked because we were out of budget for the day".
create table public.course_provider_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  provider text not null default 'golfcourseapi',
  operation text not null check (operation in ('search', 'get_details', 'refresh')),
  -- Normalized (trimmed/lowercased/whitespace-collapsed) search query,
  -- hashed rather than stored in the clear -- it's only ever compared for
  -- equality (dedup/cache-key purposes in the admin view), never displayed,
  -- and hashing keeps a user's literal search terms out of a log table
  -- that's already admin-only but still worth minimizing.
  normalized_query_hash text,
  external_course_id text,
  cache_hit boolean not null default false,
  -- Null status_code means the request never actually reached the
  -- provider (blocked by the daily cap, a disabled feature flag, or
  -- input validation) -- distinct from a real provider response.
  status_code integer,
  -- One of a small fixed set of sanitized reasons -- never the raw
  -- provider response body or error message, which could leak more than
  -- intended into a log table. Null on success.
  sanitized_error_code text check (
    sanitized_error_code is null or sanitized_error_code in (
      'not_configured', 'disabled', 'daily_limit_reached', 'invalid_query',
      'unauthorized', 'forbidden', 'not_found', 'validation_error',
      'rate_limited', 'timeout', 'network_error', 'server_error', 'unknown'
    )
  ),
  created_at timestamptz not null default now()
);
create index course_provider_requests_created_at_idx on public.course_provider_requests (created_at);
create index course_provider_requests_user_id_idx on public.course_provider_requests (user_id);

comment on table public.course_provider_requests is
  'Usage/audit log for every course-provider operation this app attempts, successful or not, cache-hit or not. Admin-only to read (see RLS) -- ordinary users never see provider request counts or errors. Rows are written by the trusted server actions in src/actions/course-import.ts on behalf of the calling user, not by client code.';

-- User-submitted proposed corrections to provider-sourced (or
-- user-sourced) course data. Deliberately a separate table rather than
-- ever writing straight into courses/course_tee_sets/course_holes on a
-- user's report -- the shared record only changes via admin review
-- (courses_update_own_or_admin already restricts direct edits to the
-- creator or an admin; a golfer who merely spotted a wrong yardage on an
-- imported course is neither).
create table public.course_corrections (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  submitted_by uuid references public.profiles(id) on delete set null,
  issue_type text not null check (issue_type in (
    'wrong_par', 'wrong_yardage', 'wrong_tee_name', 'missing_tee',
    'wrong_stroke_index', 'duplicate_course', 'closed_or_renamed', 'other'
  )),
  tee_set_id uuid references public.course_tee_sets(id) on delete set null,
  hole_number smallint check (hole_number is null or hole_number between 1 and 18),
  current_value text,
  proposed_value text,
  reason text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index course_corrections_course_id_idx on public.course_corrections (course_id);
create index course_corrections_status_idx on public.course_corrections (status);

comment on table public.course_corrections is
  'Proposed corrections to a course record, submitted by any authenticated user. Never applied automatically -- an admin reviews and, if they agree, edits the underlying courses/course_tee_sets/course_holes row themselves (courses_update_own_or_admin already allows that) and marks the correction approved. A round-specific fix that should not wait for admin review at all is instead stored directly in that round''s own round_course_snapshots row (see src/actions/rounds.ts) by the round''s organizer, before the round starts -- that path never touches this table.';

create trigger trg_course_corrections_updated_at
  before update on public.course_corrections
  for each row execute function public.set_updated_at();

alter table public.course_provider_requests enable row level security;
alter table public.course_corrections enable row level security;

revoke all on public.course_provider_requests from anon;
revoke all on public.course_corrections from anon;

grant select, insert on public.course_provider_requests to authenticated;
grant select, insert, update on public.course_corrections to authenticated;

-- course_provider_requests: any authenticated user may log a request
-- attributed to themselves (the trusted server action sets user_id to
-- the caller -- a client could still call this directly with a
-- mismatched user_id, but the worst case is a mislabeled log row, not
-- access to anyone else's data). Only admins may ever read them back --
-- usage/error data is explicitly admin-only per the integration spec.
create policy "course_provider_requests_insert_own" on public.course_provider_requests
  for insert to authenticated
  with check (user_id = auth.uid() or user_id is null);

create policy "course_provider_requests_select_admin" on public.course_provider_requests
  for select to authenticated
  using (public.is_app_admin());

-- course_corrections: any authenticated user may propose a correction
-- (attributed to themselves) and see their own submissions; admins can
-- see and update (approve/reject) every submission. No one but an admin
-- can change `status` -- enforced by the with check below requiring
-- either admin, or a non-admin insert (handled by the insert policy) but
-- never a non-admin update.
create policy "course_corrections_insert_own" on public.course_corrections
  for insert to authenticated
  with check (submitted_by = auth.uid());

create policy "course_corrections_select_own_or_admin" on public.course_corrections
  for select to authenticated
  using (submitted_by = auth.uid() or public.is_app_admin());

create policy "course_corrections_update_admin_only" on public.course_corrections
  for update to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());

do $$
begin
  if has_table_privilege('anon', 'public.course_provider_requests', 'select') then
    raise exception 'anon must not have any grant on course_provider_requests';
  end if;
  if has_table_privilege('anon', 'public.course_corrections', 'select') then
    raise exception 'anon must not have any grant on course_corrections';
  end if;
end $$;
