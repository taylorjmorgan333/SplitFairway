-- Live scorecard (phase 6). One row per golfer per hole; gross strokes
-- only -- net score is computed at read time from playing_handicap and
-- the round's course-snapshot stroke indexes (src/lib/golf/handicap.ts),
-- never stored, since a stored net score would go stale the moment
-- playing_handicap is adjusted after some holes are already entered.
--
-- Every insert/update is mirrored into score_change_history by a
-- trigger, not by the calling action -- this is what makes "keep a
-- full score-change history" true regardless of which code path wrote
-- the score, including any future admin-correction workflow (phase 10)
-- that isn't built yet.

create table public.hole_scores (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds(id) on delete cascade,
  round_player_id uuid not null references public.round_players(id) on delete cascade,
  hole_number smallint not null check (hole_number between 1 and 18),
  gross_strokes smallint check (gross_strokes is null or gross_strokes between 1 and 20),
  entered_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hole_scores_unique_hole unique (round_player_id, hole_number)
);
create index hole_scores_round_id_idx on public.hole_scores (round_id);
create index hole_scores_round_player_id_idx on public.hole_scores (round_player_id);

comment on table public.hole_scores is
  'Gross strokes per golfer per hole. round_id is denormalized from round_player_id purely so RLS/authorization checks here don''t need an extra join -- round_players.round_id is still the source of truth, enforced by the trigger below.';

create trigger trg_hole_scores_updated_at
  before update on public.hole_scores
  for each row execute function public.set_updated_at();

-- A hole_score's round_id must match its round_player's round_id --
-- the same cross-table integrity gap a plain foreign key can't close,
-- already solved once for round_players itself.
create or replace function public.validate_hole_score_round()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player_round_id uuid;
begin
  select round_id into v_player_round_id from public.round_players where id = new.round_player_id;
  if v_player_round_id is null or v_player_round_id != new.round_id then
    raise exception 'hole_scores.round_id must match round_players.round_id for round_player_id';
  end if;
  return new;
end;
$$;

create trigger trg_validate_hole_score_round
  before insert or update on public.hole_scores
  for each row execute function public.validate_hole_score_round();

create table public.score_change_history (
  id uuid primary key default gen_random_uuid(),
  hole_score_id uuid not null references public.hole_scores(id) on delete cascade,
  round_id uuid not null references public.rounds(id) on delete cascade,
  round_player_id uuid not null references public.round_players(id) on delete cascade,
  hole_number smallint not null,
  previous_gross_strokes smallint,
  new_gross_strokes smallint,
  changed_by uuid references public.profiles(id) on delete set null,
  changed_at timestamptz not null default now()
);
create index score_change_history_round_id_idx on public.score_change_history (round_id);
create index score_change_history_hole_score_id_idx on public.score_change_history (hole_score_id);

comment on table public.score_change_history is
  'Append-only audit trail, written only by log_hole_score_change() below -- never by application code directly (authenticated has no INSERT grant on this table at all), so every score change is captured regardless of which UI path wrote it.';

create or replace function public.log_hole_score_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.score_change_history (
    hole_score_id, round_id, round_player_id, hole_number,
    previous_gross_strokes, new_gross_strokes, changed_by
  ) values (
    new.id, new.round_id, new.round_player_id, new.hole_number,
    case when tg_op = 'UPDATE' then old.gross_strokes else null end,
    new.gross_strokes,
    auth.uid()
  );
  return new;
end;
$$;

create trigger trg_log_hole_score_change
  after insert or update on public.hole_scores
  for each row execute function public.log_hole_score_change();

-- Score visibility respects a round's live_score_visibility toggle: if
-- it's on, any trip member can see any score; if it's off, a golfer can
-- only see their own scores, their group-mates' scores, and the
-- organizer can always see everything. Score EDIT rights follow the
-- round's score_edit_scope the same way edit-vs-view splits everywhere
-- else in this schema -- both are centralized here as functions rather
-- than repeated inline in every policy below.
create or replace function public.can_view_round_score(p_round_player_id uuid)
returns boolean
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_trip_id uuid;
  v_visible boolean;
  v_group_id uuid;
  v_my_round_player_id uuid;
  v_my_group_id uuid;
begin
  select r.trip_id, r.live_score_visibility, rp.group_id
    into v_trip_id, v_visible, v_group_id
  from public.round_players rp
  join public.rounds r on r.id = rp.round_id
  where rp.id = p_round_player_id;

  if v_trip_id is null then
    return false;
  end if;

  if not public.is_trip_member(v_trip_id) then
    return false;
  end if;

  if public.is_trip_captain(v_trip_id) or v_visible then
    return true;
  end if;

  select rp2.id, rp2.group_id into v_my_round_player_id, v_my_group_id
  from public.round_players rp2
  join public.trip_members tm on tm.id = rp2.trip_member_id
  where rp2.round_id = (select round_id from public.round_players where id = p_round_player_id)
    and tm.user_id = auth.uid();

  return v_my_round_player_id = p_round_player_id
    or (v_my_group_id is not null and v_my_group_id = v_group_id);
end;
$$;

-- Deliberately also denies edits once a round is locked, for every
-- caller including the organizer -- a locked round's scores are meant
-- to be immutable through this normal path. A later phase (results
-- correction, phase 10) can add its own distinct, separately-audited
-- path for a locked round without this function needing to change.
create or replace function public.can_edit_round_score(p_round_player_id uuid)
returns boolean
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_trip_id uuid;
  v_round_id uuid;
  v_status public.round_status;
  v_scope public.round_score_edit_scope;
  v_group_id uuid;
  v_my_round_player_id uuid;
  v_my_group_id uuid;
begin
  select r.trip_id, r.id, r.status, r.score_edit_scope, rp.group_id
    into v_trip_id, v_round_id, v_status, v_scope, v_group_id
  from public.round_players rp
  join public.rounds r on r.id = rp.round_id
  where rp.id = p_round_player_id;

  if v_trip_id is null or v_status = 'locked' or v_status = 'completed' then
    return false;
  end if;

  if public.is_trip_captain(v_trip_id) then
    return true;
  end if;

  if not public.is_trip_member(v_trip_id) then
    return false;
  end if;

  select rp2.id, rp2.group_id into v_my_round_player_id, v_my_group_id
  from public.round_players rp2
  join public.trip_members tm on tm.id = rp2.trip_member_id
  where rp2.round_id = v_round_id and tm.user_id = auth.uid();

  if v_my_round_player_id is null then
    return false;
  end if;

  if v_scope = 'per_group' and v_my_group_id is not null then
    return v_my_group_id = v_group_id;
  end if;

  return v_my_round_player_id = p_round_player_id;
end;
$$;

revoke all on function public.can_view_round_score(uuid) from public;
revoke execute on function public.can_view_round_score(uuid) from anon;
grant execute on function public.can_view_round_score(uuid) to authenticated;

revoke all on function public.can_edit_round_score(uuid) from public;
revoke execute on function public.can_edit_round_score(uuid) from anon;
grant execute on function public.can_edit_round_score(uuid) to authenticated;

alter table public.hole_scores enable row level security;
alter table public.score_change_history enable row level security;

revoke all on public.hole_scores from anon;
revoke all on public.score_change_history from anon;

grant select, insert, update, delete on public.hole_scores to authenticated;
-- No insert/update grant for score_change_history -- it is written
-- only by the security-definer trigger above, and read-only to players
-- in the round it belongs to. Delete is needed for cascade from
-- hole_scores/round deletes (captain-only, via those tables' own RLS).
-- Supabase's default schema privileges auto-grant `authenticated`
-- insert/update on every new public table (the same gotcha the anon
-- revokes elsewhere in this codebase work around) -- explicitly revoke
-- those before granting only what this table should actually allow.
revoke insert, update on public.score_change_history from authenticated;
grant select, delete on public.score_change_history to authenticated;

create policy "hole_scores_select_visible" on public.hole_scores
  for select to authenticated
  using (public.can_view_round_score(round_player_id));

create policy "hole_scores_insert_editable" on public.hole_scores
  for insert to authenticated
  with check (public.can_edit_round_score(round_player_id));

create policy "hole_scores_update_editable" on public.hole_scores
  for update to authenticated
  using (public.can_edit_round_score(round_player_id))
  with check (public.can_edit_round_score(round_player_id));

-- Deletes happen only as a cascade from round_players/rounds deletes
-- (both captain-gated by their own RLS) -- no UI path deletes a single
-- hole_score directly, so this policy only needs to allow the cascade,
-- scoped the same way round_players deletes already are.
create policy "hole_scores_delete_captain" on public.hole_scores
  for delete to authenticated
  using (exists (
    select 1 from public.rounds r where r.id = hole_scores.round_id and public.is_trip_captain(r.trip_id)
  ));

create policy "score_change_history_select_visible" on public.score_change_history
  for select to authenticated
  using (public.can_view_round_score(round_player_id));

create policy "score_change_history_delete_captain" on public.score_change_history
  for delete to authenticated
  using (exists (
    select 1 from public.rounds r where r.id = score_change_history.round_id and public.is_trip_captain(r.trip_id)
  ));

do $$
begin
  if has_table_privilege('anon', 'public.hole_scores', 'select') then
    raise exception 'anon must not have any grant on hole_scores';
  end if;
  if has_table_privilege('anon', 'public.score_change_history', 'select') then
    raise exception 'anon must not have any grant on score_change_history';
  end if;
  if has_table_privilege('authenticated', 'public.score_change_history', 'insert') then
    raise exception 'authenticated must not be able to insert score_change_history directly';
  end if;
  if has_function_privilege('anon', 'public.can_view_round_score(uuid)', 'execute') then
    raise exception 'anon must not be able to execute can_view_round_score';
  end if;
  if has_function_privilege('anon', 'public.can_edit_round_score(uuid)', 'execute') then
    raise exception 'anon must not be able to execute can_edit_round_score';
  end if;
end $$;
