import type { PlayerTeamColor } from "@/lib/validation/round";

export type { PlayerTeamColor };

/**
 * The 8 selectable team colors for round_players.team_color. Purely a
 * shared "same color = same team" grouping a group agrees on by eye on
 * the round's Players card -- distinct from round_groups (physical
 * foursomes/starting holes) and from a specific side game's own
 * two-side split (side_game_participants.side).
 */
export const TEAM_COLORS: { value: PlayerTeamColor; label: string; swatchClass: string }[] = [
  { value: "red", label: "Red", swatchClass: "bg-red-500" },
  { value: "orange", label: "Orange", swatchClass: "bg-orange-500" },
  { value: "yellow", label: "Yellow", swatchClass: "bg-yellow-400" },
  { value: "green", label: "Green", swatchClass: "bg-green-500" },
  { value: "teal", label: "Teal", swatchClass: "bg-teal-500" },
  { value: "blue", label: "Blue", swatchClass: "bg-blue-500" },
  { value: "purple", label: "Purple", swatchClass: "bg-purple-500" },
  { value: "pink", label: "Pink", swatchClass: "bg-pink-500" },
];

export const TEAM_COLOR_SWATCH: Record<PlayerTeamColor, string> = Object.fromEntries(
  TEAM_COLORS.map((c) => [c.value, c.swatchClass]),
) as Record<PlayerTeamColor, string>;

export const TEAM_COLOR_LABEL: Record<PlayerTeamColor, string> = Object.fromEntries(
  TEAM_COLORS.map((c) => [c.value, c.label]),
) as Record<PlayerTeamColor, string>;
