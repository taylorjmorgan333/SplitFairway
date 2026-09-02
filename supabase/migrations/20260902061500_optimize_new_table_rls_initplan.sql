-- The Supabase performance advisor flagged analytics_events and
-- beta_feedback for calling auth.uid() directly in RLS policies,
-- which forces Postgres to re-evaluate it for every row. Every other
-- table in this schema already wraps it as (select auth.uid()) so it
-- is evaluated once per statement (the InitPlan optimization). Bring
-- these two brand-new tables in line with that established pattern.

drop policy if exists analytics_events_insert_own on public.analytics_events;
create policy analytics_events_insert_own
  on public.analytics_events
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists beta_feedback_insert_own on public.beta_feedback;
create policy beta_feedback_insert_own
  on public.beta_feedback
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists beta_feedback_select_own on public.beta_feedback;
create policy beta_feedback_select_own
  on public.beta_feedback
  for select
  to authenticated
  using (user_id = (select auth.uid()));

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'analytics_events'
      and policyname = 'analytics_events_insert_own'
      and with_check ilike '%select%'
  ) then
    raise exception 'analytics_events_insert_own: not using (select auth.uid())';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'beta_feedback'
      and policyname = 'beta_feedback_insert_own'
      and with_check ilike '%select%'
  ) then
    raise exception 'beta_feedback_insert_own: not using (select auth.uid())';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'beta_feedback'
      and policyname = 'beta_feedback_select_own'
      and qual ilike '%select%'
  ) then
    raise exception 'beta_feedback_select_own: not using (select auth.uid())';
  end if;
end $$;
