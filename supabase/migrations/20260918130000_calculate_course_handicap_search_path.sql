-- Fixes the "Function Search Path Mutable" advisory the Supabase
-- linter raised against calculate_course_handicap
-- (20260918120000_course_handicap_sql_mirror.sql): every other
-- function in this schema pins search_path explicitly (see
-- handle_handicap_change, is_app_admin, etc.) so it can't be tricked by
-- a session that has changed its own search_path; this one was missed
-- because a plain `language sql` function doesn't strictly need it for
-- correctness here (it only touches literal numerics, no unqualified
-- table/function references), but pinning it is free and keeps every
-- function in this schema consistent with the same defensive posture.
create or replace function public.calculate_course_handicap(
  p_handicap_index numeric,
  p_slope_rating numeric,
  p_course_rating numeric,
  p_par numeric
) returns numeric
language sql
immutable
set search_path = public
as $$
  select case
    when p_handicap_index is null or p_slope_rating is null or p_course_rating is null or p_par is null
      then null
    -- floor(x + 0.5) rounds an exact .5 upward/toward positive infinity
    -- for both positive and negative values (Postgres's own round()
    -- rounds half AWAY from zero instead, e.g. round(-2.5) = -3, which
    -- would disagree with roundHandicap()'s documented -2.5 -> -2).
    else floor(p_handicap_index * (p_slope_rating / 113.0) + (p_course_rating - p_par) + 0.5)
  end;
$$;

comment on function public.calculate_course_handicap is
  'SQL mirror of src/lib/golf/handicap.ts#calculateCourseHandicap -- used only by accept_group_invitation, which cannot call TypeScript. Keep both implementations in exact agreement; see that file for the canonical version and its unit tests.';
