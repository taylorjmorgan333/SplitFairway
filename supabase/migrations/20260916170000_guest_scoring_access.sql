-- SplitFairway Phase 2 cleanup: passwordless guest scoring, step 1.
--
-- Introduces a real, narrowly-scoped access tier for a golfer with no
-- SplitFairway account at all -- distinct from the existing
-- golf_group_invitations "guest" role (added in the prior migration
-- batch), which still requires the invitee to sign up/log in first.
-- That older path is left completely untouched; this is new,
-- additive infrastructure for a genuinely passwordless flow, built on
-- Supabase's anonymous auth (auth.users row with is_anonymous = true,
-- Postgres role `authenticated`, a real auth.uid()) rather than any
-- new session mechanism of this app's own.
--
-- Key design point: a passwordless guest becomes a normal
-- trip_members row (user_id = the anonymous auth.uid(), scoped to
-- exactly the one trip their round belongs to) and a normal
-- round_players row for exactly the one round they were invited to.
-- No golf_group_members row is ever created for them, so none of the
-- group-scoped SELECT policies added in the previous migration batch
-- (trips_select_group_members and friends, gated on is_group_member)
-- ever apply -- a passwordless guest is invisible to those policies
-- and gets zero cross-trip/cross-group visibility through them.
-- Ordinary is_trip_member-gated access (rounds, round_players,
-- hole_scores, round_course_snapshots, side_games -- the actual
-- scoring surface) is left entirely as-is: every one of those RLS
-- policies and their can_view_round_score/can_edit_round_score
-- helper functions already work correctly for any trip_members row
-- regardless of how it was created, including this one. Nothing
-- about "working scoring" changes.
--
-- The one real gap this migration closes: is_trip_member alone would
-- also grant a guest read access to this trip's expenses,
-- expense_shares, payments and activity_log -- true financial/audit
-- data, not scoring data, and exactly what the spec calls out
-- ("prevent access to ... private financial information"). A plain
-- trip_members.preferred_payment_method/payment_handle (added in
-- 20260910130000) is NOT treated as financial-secret here -- that
-- column is intentionally shared with every trip mate by design ("so
-- trip mates know where to send money without asking", per that
-- migration's own comment) and stays visible exactly as it already
-- is for every existing member; this migration does not touch it.

alter table public.trip_members
  add column is_guest boolean not null default false;

comment on column public.trip_members.is_guest is
  'True only for a trip_members row created by create_group_guest_invitation() for passwordless scoring access -- never set for a real signed-up member, including one invited manually via add_trip_member_manually(). Read by is_guest_trip_member()/is_full_trip_member() to keep a passwordless guest out of this trip''s financial data while leaving every other existing member unaffected (defaults false).';

-- True only when the current session is a passwordless guest
-- (is_trip_member already true) for this specific trip. Kept separate
-- from is_full_trip_member below so a future caller can ask either
-- question directly.
create or replace function public.is_guest_trip_member(p_trip_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.trip_members
    where trip_id = p_trip_id
      and user_id = auth.uid()
      and status = 'active'
      and is_guest = true
  );
$$;

-- The predicate every financial/audit table's SELECT policy should
-- use instead of bare is_trip_member: true for every existing member
-- exactly as before (is_guest defaults false, so this is identical to
-- is_trip_member for them), false for a passwordless guest. Scoring
-- tables (rounds, round_players, hole_scores, round_course_snapshots,
-- side_games, side_game_participants) deliberately keep using plain
-- is_trip_member / is_group_member unchanged -- a guest is meant to
-- see the scoring context of their own trip, just never its money.
create or replace function public.is_full_trip_member(p_trip_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.is_trip_member(p_trip_id) and not public.is_guest_trip_member(p_trip_id);
$$;

-- Swap is_trip_member -> is_full_trip_member on exactly the
-- financial/audit SELECT policies. Every other clause on these
-- policies (captain-only insert/update/delete, self-only payment
-- report/edit) is reproduced verbatim from
-- 20260902023949_rls_policies.sql / 20260902024127_security_hardening_and_perf.sql
-- -- only the read gate changes, and only for these four tables.
drop policy "expenses_select_members" on public.expenses;
create policy "expenses_select_members" on public.expenses
  for select to authenticated
  using (public.is_full_trip_member(trip_id));

drop policy "expense_shares_select_members" on public.expense_shares;
create policy "expense_shares_select_members" on public.expense_shares
  for select to authenticated
  using (exists (
    select 1 from public.expenses e
    where e.id = expense_shares.expense_id and public.is_full_trip_member(e.trip_id)
  ));

drop policy "payments_select_members" on public.payments;
create policy "payments_select_members" on public.payments
  for select to authenticated
  using (public.is_full_trip_member(trip_id));

drop policy "activity_log_select_members" on public.activity_log;
create policy "activity_log_select_members" on public.activity_log
  for select to authenticated
  using (public.is_full_trip_member(trip_id));
