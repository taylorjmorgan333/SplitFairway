-- Extends validate_side_game_participant() (originally
-- supabase/migrations/20260903080000_side_games.sql, already updated
-- once by 20260903090100_side_games_wolf_vegas_quota_nines_twos.sql) so
-- the 13 new Batch 1 types added in the preceding migration get the
-- right side/side-less shape enforced:
--
--   * Two-sided (side must be 1 or 2), same shape as nassau/vegas:
--     match_play, best_ball, worst_ball, shamble, team_average,
--     low_ball_high_ball, low_ball_low_total, low_handicap_high_handicap,
--     one_gross_one_net, lone_ranger, cha_cha_cha -- all of them read as
--     "side 1 vs side 2" formats, differing only in the formula/display,
--     computed entirely in src/lib/golf/team-formats.ts.
--   * Side-less, same shape as skins/quota/nines/twos: stroke_play,
--     stableford -- field-wide leaderboards, no sides.
--
-- None of these 13 need a wolf_order either, so that branch of the
-- function is untouched.
create or replace function public.validate_side_game_participant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game_round_id uuid;
  v_game_type public.side_game_type;
  v_player_round_id uuid;
  v_two_sided_types public.side_game_type[] := array[
    'nassau', 'vegas', 'match_play', 'best_ball', 'worst_ball', 'shamble',
    'team_average', 'low_ball_high_ball', 'low_ball_low_total',
    'low_handicap_high_handicap', 'one_gross_one_net', 'lone_ranger', 'cha_cha_cha'
  ]::public.side_game_type[];
begin
  select round_id, game_type into v_game_round_id, v_game_type
  from public.side_games where id = new.side_game_id;

  select round_id into v_player_round_id
  from public.round_players where id = new.round_player_id;

  if v_game_round_id is null or v_player_round_id is null or v_game_round_id != v_player_round_id then
    raise exception 'side_game_participants.round_player_id must belong to the same round as side_game_id';
  end if;

  if v_game_type = any(v_two_sided_types) and new.side is null then
    raise exception 'a % participant must have a side (1 or 2)', v_game_type;
  end if;

  if not (v_game_type = any(v_two_sided_types)) and new.side is not null then
    raise exception 'a % participant must not have a side', v_game_type;
  end if;

  if v_game_type = 'wolf' and new.wolf_order is null then
    raise exception 'a wolf participant must have a wolf_order (0-3)';
  end if;

  if v_game_type != 'wolf' and new.wolf_order is not null then
    raise exception 'wolf_order only applies to wolf games';
  end if;

  return new;
end;
$$;
