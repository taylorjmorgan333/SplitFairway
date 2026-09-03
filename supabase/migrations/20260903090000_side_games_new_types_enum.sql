-- Adds the four new side_game_type values needed for wolf/vegas/quota/
-- nines/twos (phase 9 follow-up: more popular golf gambling games,
-- picked from the same shortlist Squabbit's format list and independent
-- research both surfaced as most common alongside the already-shipped
-- Nassau and skins). Split into its own migration file, committed on
-- its own, because Postgres won't let a newly added enum value be used
-- by name (in a check constraint, a PL/pgSQL comparison, etc.) within
-- the same transaction that added it -- the next migration file relies
-- on these being already committed.
alter type public.side_game_type add value 'wolf';
alter type public.side_game_type add value 'vegas';
alter type public.side_game_type add value 'quota';
alter type public.side_game_type add value 'nines';
alter type public.side_game_type add value 'twos';
