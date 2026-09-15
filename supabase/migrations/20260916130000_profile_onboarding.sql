-- SplitFairway daily-use revamp (Phase 2): lightweight first-run
-- onboarding gate. Every EXISTING account is backfilled to "already
-- done" in the same statement that adds the column, so no one who's
-- already using the app is ever shown onboarding -- only a profile row
-- created after this migration (a brand-new signup) starts out null
-- and sees the three-step flow once, at src/app/onboarding/page.tsx.
alter table public.profiles add column onboarding_completed_at timestamptz;

update public.profiles set onboarding_completed_at = now() where onboarding_completed_at is null;

comment on column public.profiles.onboarding_completed_at is
  'Set the first time this user finishes (or skips) the first-run onboarding flow. Null means "show onboarding next time they load the app" -- see (app)/layout.tsx.';
