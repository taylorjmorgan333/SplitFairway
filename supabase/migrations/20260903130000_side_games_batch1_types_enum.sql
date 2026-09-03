-- Adds the 13 new side_game_type values for Batch 1 of the Squabbit-list
-- expansion (games/game-type-picker.tsx): formats that are pure
-- aggregation formulas over scores already recorded via hole_scores, so
-- unlike wolf's side_game_wolf_picks table, none of these need any new
-- columns or tables -- see the immediately following migration for the
-- one thing that does need updating (validate_side_game_participant()'s
-- side-required/side-must-be-null lists). Split into its own file for
-- the same reason 20260903090000_side_games_new_types_enum.sql was:
-- Postgres won't let a newly added enum value be used by name within the
-- same transaction that added it.
alter type public.side_game_type add value 'match_play';
alter type public.side_game_type add value 'stroke_play';
alter type public.side_game_type add value 'stableford';
alter type public.side_game_type add value 'best_ball';
alter type public.side_game_type add value 'worst_ball';
alter type public.side_game_type add value 'shamble';
alter type public.side_game_type add value 'team_average';
alter type public.side_game_type add value 'low_ball_high_ball';
alter type public.side_game_type add value 'low_ball_low_total';
alter type public.side_game_type add value 'low_handicap_high_handicap';
alter type public.side_game_type add value 'one_gross_one_net';
alter type public.side_game_type add value 'lone_ranger';
alter type public.side_game_type add value 'cha_cha_cha';
