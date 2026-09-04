-- Adds a 'custom' side_game_type for the redesign's "Custom Game"
-- option in the common-6 game picker: a simple freeform game (a name,
-- optional participants, optional dollar value) with no automatic
-- scoring engine behind it -- the group tracks and settles the outcome
-- themselves, same shape as every other side_games row but with
-- nothing in src/lib/golf/ computing a result for it. Split into its
-- own migration, committed on its own, because Postgres won't let a
-- newly added enum value be used by name within the same transaction
-- that added it.
alter type public.side_game_type add value 'custom';
