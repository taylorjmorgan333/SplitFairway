-- Saved/favorited courses (Quick Round redesign, course-picker addendum:
-- "Saved Courses: show favorited/saved courses first"). Purely additive
-- and per-user -- this never touches scoring, handicaps, rounds, or any
-- existing course/tee-set/hole data. A golfer favorites a course from
-- their own course library; the Quick Round setup screen's unified
-- course picker reads this table to show their saved courses ahead of
-- their merely-recently-played ones. One row per (user, course) --
-- toggling is just "does my row exist" (delete if so, insert if not),
-- so this can never accumulate duplicate saved-course records for the
-- same course.

create table public.course_favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint course_favorites_user_course_unique unique (user_id, course_id)
);

comment on table public.course_favorites is
  'One row per (user, course) a golfer has starred as a "saved course" -- read by the Quick Round setup screen''s unified course picker to show saved courses ahead of merely-recently-played ones. Toggled by toggleFavoriteCourseAction (src/actions/course-favorites.ts); the unique constraint is what keeps a repeated favorite tap from ever creating a duplicate row.';

create index course_favorites_user_id_idx on public.course_favorites (user_id, created_at desc);

alter table public.course_favorites enable row level security;

-- Same convention as every other per-user table in this project
-- (e.g. golf_profiles): Supabase's default schema privileges grant anon
-- broad table access on every new `public` table -- revoke it
-- explicitly rather than relying on RLS alone.
revoke all on public.course_favorites from anon;
grant select, insert, delete on public.course_favorites to authenticated;

create policy "course_favorites_select_own" on public.course_favorites
  for select to authenticated
  using (user_id = auth.uid());

create policy "course_favorites_insert_own" on public.course_favorites
  for insert to authenticated
  with check (user_id = auth.uid());

create policy "course_favorites_delete_own" on public.course_favorites
  for delete to authenticated
  using (user_id = auth.uid());

do $$
begin
  if has_table_privilege('anon', 'public.course_favorites', 'select') then
    raise exception 'anon must not have any grant on course_favorites';
  end if;
end $$;
