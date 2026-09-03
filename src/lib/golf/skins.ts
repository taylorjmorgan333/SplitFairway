import { bestScoreOnHole, type PlayerScoreInput } from "@/lib/golf/scoring";

/**
 * Skins scoring (phase 9): the outright best (lowest) score on a hole
 * wins it -- a tie wins nothing. With carryover on, a tied hole's skin
 * rolls into the next hole's pot instead of being lost, so a run of
 * ties can make one hole worth several skins. Built on
 * scoring.ts#bestScoreOnHole, the same "who had the best score on this
 * hole" primitive the live leaderboard's engine already exposes.
 */

export interface SkinHoleResult {
  holeNumber: number;
  /** null when the hole isn't fully scored yet, or when it was tied with carryover off (no one won it). */
  winnerRoundPlayerId: string | null;
  /** How many skins this hole was worth when it was won (1, or more with carryover). 0 if no one won it. */
  skinsWon: number;
  /** True if this hole was tied and its skin(s) carried into the next hole. */
  carriedOver: boolean;
}

export interface SkinsResult {
  holes: SkinHoleResult[];
  totalsByPlayer: Map<string, number>;
  /** Skins currently riding on the next unplayed/undecided hole (>1 only when carryover holes are pending). */
  pendingPot: number;
}

function holeIsComplete(players: PlayerScoreInput[], holeNumber: number): boolean {
  return players.length > 0 && players.every((p) => p.grossByHole.get(holeNumber) != null);
}

export function computeSkins(
  players: PlayerScoreInput[],
  holeNumbers: number[],
  metric: "gross" | "net",
  carryover: boolean,
): SkinsResult {
  const holes: SkinHoleResult[] = [];
  const totalsByPlayer = new Map<string, number>(players.map((p) => [p.roundPlayerId, 0]));
  let pot = 1;

  for (const holeNumber of holeNumbers) {
    if (!holeIsComplete(players, holeNumber)) break;

    const best = bestScoreOnHole(players, holeNumber, metric);
    if (best && !best.isTie) {
      holes.push({ holeNumber, winnerRoundPlayerId: best.roundPlayerId, skinsWon: pot, carriedOver: false });
      totalsByPlayer.set(best.roundPlayerId, (totalsByPlayer.get(best.roundPlayerId) ?? 0) + pot);
      pot = 1;
    } else if (carryover) {
      holes.push({ holeNumber, winnerRoundPlayerId: null, skinsWon: 0, carriedOver: true });
      pot += 1;
    } else {
      holes.push({ holeNumber, winnerRoundPlayerId: null, skinsWon: 0, carriedOver: false });
      pot = 1;
    }
  }

  return { holes, totalsByPlayer, pendingPot: pot };
}
