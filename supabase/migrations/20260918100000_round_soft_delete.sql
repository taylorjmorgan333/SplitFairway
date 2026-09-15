-- Recoverable soft-delete for rounds ("Discard Round" / "Delete Round").
--
-- Purely additive: two new nullable columns on the existing rounds
-- table, so every existing row is unaffected (deleted_at defaults to
-- null, meaning "not discarded", which is exactly what every row
-- already was). No existing column, constraint, or row is touched.
--
-- Deliberately a soft delete rather than a hard `delete from rounds`:
-- round_groups/round_players/round_course_snapshots/hole_scores/
-- side_games all cascade-delete off rounds.id, so a hard delete would
-- make "Undo" impossible (the exact "recoverable" requirement this
-- migration exists to satisfy) and would also destroy the very
-- scores/games data a captain might want to double check before
-- confirming. A discarded round's rows all stay physically in place;
-- only visibility changes.

alter table public.rounds
  add column deleted_at timestamptz,
  add column deleted_by uuid references public.profiles(id) on delete set null;

comment on column public.rounds.deleted_at is
  'When set, this round has been discarded (soft-deleted) via discard_round() -- excluded from every rounds SELECT policy below, and therefore invisible to Home, active-round lists, leaderboards, and statistics without any application code needing to filter for it. Null means "not discarded" (every pre-existing row).';

comment on column public.rounds.deleted_by is
  'Who called discard_round() -- captured for audit purposes alongside the activity_log row it also writes. Not used for authorization anywhere.';

-- Lets a cleanup job or admin query find discarded rounds cheaply
-- without scanning the whole table; a normal (non-deleted) round
-- lookup already uses rounds_trip_id_idx/rounds_course_id_idx and
-- doesn't need this index at all.
create index rounds_deleted_at_idx on public.rounds (deleted_at) where deleted_at is not null;

-- Both existing SELECT policies are replaced with an identical copy
-- plus "and deleted_at is null" -- every other policy (insert/update/
-- delete) is untouched, since discard_round()/restore_round() below
-- perform their update as security definer (bypassing RLS entirely,
-- same as every other privileged RPC in this codebase) rather than
-- relying on a client-issued UPDATE.
drop policy "rounds_select_members" on public.rounds;
create policy "rounds_select_members" on public.rounds
  for select to authenticated
  using (public.is_trip_member(trip_id) and deleted_at is null);

drop policy "rounds_select_group_members" on public.rounds;
create policy "rounds_select_group_members" on public.rounds
  for select to authenticated
  using (
    deleted_at is null
    and exists (
      select 1 from public.trips t
      where t.id = rounds.trip_id and t.golf_group_id is not null and public.is_group_member(t.golf_group_id)
    )
  );

-- Every other page/query in the app that lists or aggregates rounds
-- (Home's continue/upcoming/recent rounds, a trip's rounds list, group
-- leaderboards, round recaps, the nineteenth-hole ledger, statistics)
-- fetches from the rounds table first and derives its round_players/
-- hole_scores/side_games queries from *those* ids -- so filtering here
-- is sufficient to remove a discarded round everywhere at once, with
-- no other table's RLS or any application code needing to change.

-- Discard (soft-delete) a round. Permission mirrors the product rule
-- exactly: a Quick Round (a hidden trip of kind 'quick_round', where
-- only its one creator is ever a captain -- see
-- 20260915130000_group_and_round_start_rpcs.sql) can only be discarded
-- by that creator; a Group Round or a real Trip Round can be discarded
-- by any of the trip's current captains, reusing is_trip_captain()
-- rather than inventing a parallel authorization path. Idempotent: a
-- second call on an already-discarded round is a harmless no-op
-- (needed so a slow double-tap can never raise a confusing error).
create or replace function public.discard_round(p_round_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_round public.rounds;
  v_trip public.trips;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_round from public.rounds where id = p_round_id;
  if v_round is null then
    raise exception 'Round not found';
  end if;

  if v_round.deleted_at is not null then
    return;
  end if;

  select * into v_trip from public.trips where id = v_round.trip_id;
  if v_trip is null then
    raise exception 'Trip not found';
  end if;

  if v_trip.kind = 'quick_round' then
    if v_round.created_by is distinct from auth.uid() then
      raise exception 'Only the golfer who started this Quick Round can discard it';
    end if;
  else
    if not public.is_trip_captain(v_round.trip_id) then
      raise exception 'Only a trip captain can discard this round';
    end if;
  end if;

  update public.rounds
  set deleted_at = now(), deleted_by = auth.uid()
  where id = p_round_id;

  insert into public.activity_log (trip_id, actor_user_id, event_type, event_data)
  values (v_round.trip_id, auth.uid(), 'round_discarded', jsonb_build_object('round_id', p_round_id));
end;
$$;

grant execute on function public.discard_round(uuid) to authenticated;
revoke execute on function public.discard_round(uuid) from public;
revoke execute on function public.discard_round(uuid) from anon;

-- Undo for discard_round() -- same authorization rule (the discard
-- itself already proves the caller was authorized at the time, but a
-- captain/role change in between is vanishingly unlikely and checking
-- again costs nothing and closes that edge case). Idempotent the same
-- way: restoring a round that isn't currently discarded is a no-op.
create or replace function public.restore_round(p_round_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_round public.rounds;
  v_trip public.trips;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_round from public.rounds where id = p_round_id;
  if v_round is null then
    raise exception 'Round not found';
  end if;

  if v_round.deleted_at is null then
    return;
  end if;

  select * into v_trip from public.trips where id = v_round.trip_id;
  if v_trip is null then
    raise exception 'Trip not found';
  end if;

  if v_trip.kind = 'quick_round' then
    if v_round.created_by is distinct from auth.uid() then
      raise exception 'Only the golfer who started this Quick Round can restore it';
    end if;
  else
    if not public.is_trip_captain(v_round.trip_id) then
      raise exception 'Only a trip captain can restore this round';
    end if;
  end if;

  update public.rounds
  set deleted_at = null, deleted_by = null
  where id = p_round_id;

  insert into public.activity_log (trip_id, actor_user_id, event_type, event_data)
  values (v_round.trip_id, auth.uid(), 'round_restored', jsonb_build_object('round_id', p_round_id));
end;
$$;

grant execute on function public.restore_round(uuid) to authenticated;
revoke execute on function public.restore_round(uuid) from public;
revoke execute on function public.restore_round(uuid) from anon;
