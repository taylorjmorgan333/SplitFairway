-- Enables Supabase Realtime postgres_changes events on hole_scores so
-- the live leaderboard (phase 8, gated behind LIVE_LEADERBOARD_ENABLED
-- -- src/lib/config.ts) can update as scores are entered, instead of
-- requiring a manual refresh. Realtime's postgres_changes feature
-- enforces the same RLS policies as any other read of this table
-- (hole_scores_select_visible -> can_view_round_score(), added in
-- supabase/migrations/20260903050000_hole_scores.sql) -- a subscriber
-- only ever receives change events for rows they'd already be allowed
-- to select, so turning this on does not loosen who can see a score.
-- Only the row change events are broadcast; the leaderboard component
-- then re-reads standings through the normal RLS-scoped select, so
-- there's no path for a change event to leak a hidden player's score.

alter publication supabase_realtime add table public.hole_scores;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'hole_scores'
  ) then
    raise exception 'hole_scores was not added to the supabase_realtime publication';
  end if;
end $$;
