-- Course and scorecard library (phase 4). Courses are a shared,
-- user-maintained library — not scraped from any proprietary course
-- database — with a lightweight admin-review status so a course any
-- golfer enters is usable immediately by its creator, and becomes
-- visible to everyone else only once approved. There is no existing
-- authorized course-data provider in this codebase (confirmed by
-- repository audit), so this is the whole course data source for now.

create type public.course_status as enum ('pending', 'approved', 'rejected');

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references public.profiles(id) on delete set null,
  name text not null,
  city text,
  state text,
  hole_count smallint not null check (hole_count in (9, 18)),
  status public.course_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.courses is
  'User-maintained course library. Every row is entered by a golfer, not fetched from any third-party or proprietary course database. status starts pending (usable immediately by created_by, per RLS below) and only becomes visible to every other user once an admin (public.app_admins) approves it.';

create index courses_status_idx on public.courses (status);
create index courses_created_by_idx on public.courses (created_by);

create table public.course_tee_sets (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  name text not null, -- e.g. "White", "Championship / Black"
  created_at timestamptz not null default now()
);
create index course_tee_sets_course_id_idx on public.course_tee_sets (course_id);

create table public.course_holes (
  id uuid primary key default gen_random_uuid(),
  tee_set_id uuid not null references public.course_tee_sets(id) on delete cascade,
  hole_number smallint not null check (hole_number between 1 and 18),
  par smallint not null check (par between 3 and 6),
  yardage integer check (yardage is null or yardage > 0),
  -- "Stroke index" / hole handicap: which holes get a stroke first when
  -- allocating playing-handicap strokes. Entered by the course creator,
  -- not computed — see the game engine (phase 7) for how it's applied.
  stroke_index smallint check (stroke_index between 1 and 18),
  constraint course_holes_unique_hole unique (tee_set_id, hole_number)
);
create index course_holes_tee_set_id_idx on public.course_holes (tee_set_id);

comment on table public.course_holes is
  'Per-tee-set, per-hole par/yardage/stroke index. Modeled per tee set (not per course) because par and stroke index can occasionally differ by tee, even though in practice most courses enter the same values for every tee set.';

-- Site-admin allowlist for course approval. Deliberately its own table
-- rather than a profiles.is_admin column: a boolean column on profiles
-- would sit inside the same row that profiles_update_own already lets
-- every user update, and Postgres RLS has no column-level granularity —
-- a client could set is_admin=true on themselves through the ordinary
-- profile-update path. This table has zero policies for `authenticated`
-- at all, so it can only ever be changed by connecting directly (the
-- Supabase SQL editor, or the same MCP path this migration itself used).
create table public.app_admins (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
comment on table public.app_admins is
  'Site-admin allowlist for course-approval authority. No RLS policy grants any access to `authenticated` — rows are managed only via direct database access, never through the app.';

alter table public.app_admins enable row level security;
revoke all on public.app_admins from anon;
revoke all on public.app_admins from authenticated;

create or replace function public.is_app_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from public.app_admins where user_id = auth.uid());
$$;

revoke all on function public.is_app_admin() from public;
revoke execute on function public.is_app_admin() from anon;
grant execute on function public.is_app_admin() to authenticated;

alter table public.courses enable row level security;
alter table public.course_tee_sets enable row level security;
alter table public.course_holes enable row level security;

revoke all on public.courses from anon;
revoke all on public.course_tee_sets from anon;
revoke all on public.course_holes from anon;

grant select, insert, update, delete on public.courses to authenticated;
grant select, insert, update, delete on public.course_tee_sets to authenticated;
grant select, insert, update, delete on public.course_holes to authenticated;

-- courses: visible if approved, or if you created it, or if you're an
-- admin (so review queues work). Editable by creator (any status) or
-- admin; only an admin can move status out of 'pending'. The
-- application layer, not RLS, is responsible for golfers never seeing a
-- status field to edit themselves — RLS just doesn't stop them from
-- writing to the status column, since "can I update this row at all"
-- is the level RLS operates at. That's an acceptable app-layer
-- boundary here: worst case a non-admin creator marks their own course
-- 'approved', which only makes their own course visible to others
-- sooner, not a privilege escalation onto someone else's data.
create policy "courses_select_visible" on public.courses
  for select to authenticated
  using (status = 'approved' or created_by = auth.uid() or public.is_app_admin());

create policy "courses_insert_own" on public.courses
  for insert to authenticated
  with check (created_by = auth.uid());

create policy "courses_update_own_or_admin" on public.courses
  for update to authenticated
  using (created_by = auth.uid() or public.is_app_admin())
  with check (created_by = auth.uid() or public.is_app_admin());

create policy "courses_delete_own_or_admin" on public.courses
  for delete to authenticated
  using (created_by = auth.uid() or public.is_app_admin());

-- tee sets / holes: same visibility and edit rights as their parent
-- course, checked through it.
create policy "course_tee_sets_select_visible" on public.course_tee_sets
  for select to authenticated
  using (exists (
    select 1 from public.courses c
    where c.id = course_tee_sets.course_id
      and (c.status = 'approved' or c.created_by = auth.uid() or public.is_app_admin())
  ));

create policy "course_tee_sets_write_own_or_admin" on public.course_tee_sets
  for insert to authenticated
  with check (exists (
    select 1 from public.courses c
    where c.id = course_tee_sets.course_id
      and (c.created_by = auth.uid() or public.is_app_admin())
  ));

create policy "course_tee_sets_update_own_or_admin" on public.course_tee_sets
  for update to authenticated
  using (exists (
    select 1 from public.courses c
    where c.id = course_tee_sets.course_id
      and (c.created_by = auth.uid() or public.is_app_admin())
  ))
  with check (exists (
    select 1 from public.courses c
    where c.id = course_tee_sets.course_id
      and (c.created_by = auth.uid() or public.is_app_admin())
  ));

create policy "course_tee_sets_delete_own_or_admin" on public.course_tee_sets
  for delete to authenticated
  using (exists (
    select 1 from public.courses c
    where c.id = course_tee_sets.course_id
      and (c.created_by = auth.uid() or public.is_app_admin())
  ));

create policy "course_holes_select_visible" on public.course_holes
  for select to authenticated
  using (exists (
    select 1 from public.course_tee_sets ts
    join public.courses c on c.id = ts.course_id
    where ts.id = course_holes.tee_set_id
      and (c.status = 'approved' or c.created_by = auth.uid() or public.is_app_admin())
  ));

create policy "course_holes_write_own_or_admin" on public.course_holes
  for insert to authenticated
  with check (exists (
    select 1 from public.course_tee_sets ts
    join public.courses c on c.id = ts.course_id
    where ts.id = course_holes.tee_set_id
      and (c.created_by = auth.uid() or public.is_app_admin())
  ));

create policy "course_holes_update_own_or_admin" on public.course_holes
  for update to authenticated
  using (exists (
    select 1 from public.course_tee_sets ts
    join public.courses c on c.id = ts.course_id
    where ts.id = course_holes.tee_set_id
      and (c.created_by = auth.uid() or public.is_app_admin())
  ))
  with check (exists (
    select 1 from public.course_tee_sets ts
    join public.courses c on c.id = ts.course_id
    where ts.id = course_holes.tee_set_id
      and (c.created_by = auth.uid() or public.is_app_admin())
  ));

create policy "course_holes_delete_own_or_admin" on public.course_holes
  for delete to authenticated
  using (exists (
    select 1 from public.course_tee_sets ts
    join public.courses c on c.id = ts.course_id
    where ts.id = course_holes.tee_set_id
      and (c.created_by = auth.uid() or public.is_app_admin())
  ));

create trigger trg_courses_updated_at
  before update on public.courses
  for each row execute function public.set_updated_at();

do $$
begin
  if has_table_privilege('anon', 'public.courses', 'select') then
    raise exception 'anon must not have any grant on courses';
  end if;
  if has_table_privilege('anon', 'public.course_tee_sets', 'select') then
    raise exception 'anon must not have any grant on course_tee_sets';
  end if;
  if has_table_privilege('anon', 'public.course_holes', 'select') then
    raise exception 'anon must not have any grant on course_holes';
  end if;
  if has_table_privilege('anon', 'public.app_admins', 'select') then
    raise exception 'anon must not have any grant on app_admins';
  end if;
  if has_table_privilege('authenticated', 'public.app_admins', 'select') then
    raise exception 'authenticated must not have any direct grant on app_admins';
  end if;
  if has_function_privilege('anon', 'public.is_app_admin()', 'execute') then
    raise exception 'anon must not be able to execute is_app_admin';
  end if;
end $$;
