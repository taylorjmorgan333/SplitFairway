import { strokesReceivedByHole, type PlayerScoreInput } from "@/lib/golf/scoring";
import { netScore } from "@/lib/golf/handicap";

/**
 * Twos Club scoring (phase 9 follow-up): make a 2 (gross or net, per
 * the game's scoring metric) on any hole and you're "in the club" for
 * that hole. Unlike skins, a hole with no one in the club simply pays
 * out nothing -- there's no carryover pot building toward a later hole.
 * Multiple players can both make a 2 on the same hole (different tees,
 * different holes' relative difficulty); when that happens they split
 * that hole's payout, funded by everyone else in the game.
 */

function valueOnHole(player: PlayerScoreInput, holeNumber: number, metric: "gross" | "net"): number | null {
  const g = player.grossByHole.get(holeNumber);
  if (g == null) return null;
  if (metric === "gross") return g;
  return netScore(g, strokesReceivedByHole(player.playingHandicap, player.holes).get(holeNumber) ?? null) ?? g;
}

function holeIsComplete(players: PlayerScoreInput[], holeNumber: number): boolean {
  return players.length > 0 && players.every((p) => p.grossByHole.get(holeNumber) != null);
}

export interface TwosHoleResult {
  holeNumber: number;
  /** 0 or more round_player_ids who made a 2 on this hole. */
  winnerRoundPlayerIds: string[];
}

export interface TwosResult {
  holes: TwosHoleResult[];
  /** How many holes each player made a 2 on. */
  totalsByPlayer: Map<string, number>;
}

export function computeTwos(
  players: PlayerScoreInput[],
  holeNumbers: number[],
  metric: "gross" | "net",
): TwosResult {
  const totalsByPlayer = new Map<string, number>(players.map((p) => [p.roundPlayerId, 0]));
  const holes: TwosHoleResult[] = [];

  for (const holeNumber of holeNumbers) {
    if (!holeIsComplete(players, holeNumber)) break;
    const winnerRoundPlayerIds = players
      .filter((p) => valueOnHole(p, holeNumber, metric) === 2)
      .map((p) => p.roundPlayerId);
    holes.push({ holeNumber, winnerRoundPlayerIds });
    for (const id of winnerRoundPlayerIds) totalsByPlayer.set(id, (totalsByPlayer.get(id) ?? 0) + 1);
  }

  return { holes, totalsByPlayer };
}
