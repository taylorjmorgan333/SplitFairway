-- Lets a captain (or the golfer themselves) tag each round_players row
-- with a team color on the round's Players card, purely as a shared
-- "same color = same team" grouping the group can agree on by eye --
-- distinct from round_groups (physical foursomes/starting holes) and
-- from side_game_participants.side (a specific game's own two-side
-- split). No RPC or new RLS policy needed: round_players_update_captain_or_self
-- already covers UPDATE on this table column-agnostically, the same way
-- tee_set_name/playing_handicap/group_id are already editable there.
create type public.player_team_color as enum (
  'red',
  'orange',
  'yellow',
  'green',
  'teal',
  'blue',
  'purple',
  'pink'
);

alter table public.round_players
  add column team_color public.player_team_color;
