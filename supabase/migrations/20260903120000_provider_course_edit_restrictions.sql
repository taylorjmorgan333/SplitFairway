-- Restricts direct edits to provider-sourced course data, per the
-- integration spec: "Authenticated users may... NOT edit provider-sourced
-- master records directly." Before this migration, courses_update_own_or_admin
-- (and the matching course_tee_sets/course_holes policies) let *any*
-- creator edit their own course forever, including a course that was
-- imported from GolfCourseAPI -- correct for a manually-entered course,
-- too permissive for provider data.
--
-- These are UPDATE/DELETE policies only, deliberately -- INSERT stays
-- unrestricted for the creator, because importExternalCourseAction and
-- refreshExternalCourseAction insert a provider-sourced courses row (and
-- its tee sets/holes) under the *calling user's own* session, not a
-- service-role bypass; a stricter INSERT policy would break import
-- itself. The residual gap this leaves -- a non-admin importer could
-- still INSERT an extra tee set onto a course they imported, though they
-- can no longer edit or delete its existing provider data -- is real,
-- narrow, and called out in the integration's final report rather than
-- left undocumented.

drop policy if exists "courses_update_own_or_admin" on public.courses;
create policy "courses_update_own_or_admin" on public.courses
  for update to authenticated
  using ((created_by = auth.uid() and external_source is null) or public.is_app_admin())
  with check ((created_by = auth.uid() and external_source is null) or public.is_app_admin());

drop policy if exists "courses_delete_own_or_admin" on public.courses;
create policy "courses_delete_own_or_admin" on public.courses
  for delete to authenticated
  using ((created_by = auth.uid() and external_source is null) or public.is_app_admin());

drop policy if exists "course_tee_sets_update_own_or_admin" on public.course_tee_sets;
create policy "course_tee_sets_update_own_or_admin" on public.course_tee_sets
  for update to authenticated
  using (exists (
    select 1 from public.courses c
    where c.id = course_tee_sets.course_id
      and ((c.created_by = auth.uid() and c.external_source is null) or public.is_app_admin())
  ))
  with check (exists (
    select 1 from public.courses c
    where c.id = course_tee_sets.course_id
      and ((c.created_by = auth.uid() and c.external_source is null) or public.is_app_admin())
  ));

drop policy if exists "course_tee_sets_delete_own_or_admin" on public.course_tee_sets;
create policy "course_tee_sets_delete_own_or_admin" on public.course_tee_sets
  for delete to authenticated
  using (exists (
    select 1 from public.courses c
    where c.id = course_tee_sets.course_id
      and ((c.created_by = auth.uid() and c.external_source is null) or public.is_app_admin())
  ));

drop policy if exists "course_holes_update_own_or_admin" on public.course_holes;
create policy "course_holes_update_own_or_admin" on public.course_holes
  for update to authenticated
  using (exists (
    select 1 from public.course_tee_sets ts
    join public.courses c on c.id = ts.course_id
    where ts.id = course_holes.tee_set_id
      and ((c.created_by = auth.uid() and c.external_source is null) or public.is_app_admin())
  ))
  with check (exists (
    select 1 from public.course_tee_sets ts
    join public.courses c on c.id = ts.course_id
    where ts.id = course_holes.tee_set_id
      and ((c.created_by = auth.uid() and c.external_source is null) or public.is_app_admin())
  ));

drop policy if exists "course_holes_delete_own_or_admin" on public.course_holes;
create policy "course_holes_delete_own_or_admin" on public.course_holes
  for delete to authenticated
  using (exists (
    select 1 from public.course_tee_sets ts
    join public.courses c on c.id = ts.course_id
    where ts.id = course_holes.tee_set_id
      and ((c.created_by = auth.uid() and c.external_source is null) or public.is_app_admin())
  ));

-- Verification: a course row with external_source set must not be
-- updatable by its creator alone (the policy expression must include the
-- "external_source is null" guard) -- this re-reads the policy
-- definitions back from the catalog rather than executing DML, so it
-- doesn't need a second test user/session to check.
do $$
declare
  v_qual text;
begin
  select qual into v_qual from pg_policies
    where schemaname = 'public' and tablename = 'courses' and policyname = 'courses_update_own_or_admin';
  if v_qual is null or v_qual not ilike '%external_source%' then
    raise exception 'courses_update_own_or_admin must guard on external_source';
  end if;
end $$;
