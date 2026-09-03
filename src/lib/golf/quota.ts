import type { PlayerScoreInput } from "@/lib/golf/scoring";

/**
 * Quota scoring (phase 9 follow-up): each player gets a personal point
 * target from their handicap, then earns points hole by hole based on
 * gross score vs. par. Beating your own quota (not anyone else's score)
 * is the whole game -- unlike Stableford, there's no field-wide points
 * race here, just each player against their own number.
 *
 * Deliberately GROSS scoring only, never net: the handicap adjustment
 * is already what sets the personal quota target below, so scoring net
 * strokes against par on top of that would apply the same handicap
 * twice. This is why quota games don't offer a scoring-metric choice in
 * the create form the way Nassau/skins/vegas do.
 */

/** Eagle-or-better = 8, birdie = 4, par = 2, bogey = 1, double bogey or worse = 0 -- quota's own points table, different from Stableford's (scoring.ts#stablefordPointsForHole). */
export function quotaPointsForHole(gross: number, par: number): number {
  const diff = gross - par;
  if (diff <= -2) return 8;
  if (diff === -1) return 4;
  if (diff === 0) return 2;
  if (diff === 1) return 1;
  return 0;
}

/** Standard quota target: 36 minus playing handicap. Falls back to a scratch (0) handicap -- a 36 target -- when no playing handicap is on file, the same "show a real number rather than nothing" fallback scoring.ts's net columns use for a golfer without one set. */
export function quotaTarget(playingHandicap: number | null): number {
  return 36 - (playingHandicap ?? 0);
}

export interface QuotaPlayerResult {
  roundPlayerId: string;
  target: number;
  points: number;
  holesCompleted: number;
  /** points - target: positive means beating quota. */
  differential: number;
}

export function computeQuota(players: PlayerScoreInput[], holeNumbers: number[]): QuotaPlayerResult[] {
  return players.map((p) => {
    let points = 0;
    let holesCompleted = 0;
    for (const holeNumber of holeNumbers) {
      const hole = p.holes.find((h) => h.holeNumber === holeNumber);
      const gross = p.grossByHole.get(holeNumber);
      if (!hole || gross == null) continue;
      points += quotaPointsForHole(gross, hole.par);
      holesCompleted += 1;
    }
    const target = quotaTarget(p.playingHandicap);
    return { roundPlayerId: p.roundPlayerId, target, points, holesCompleted, differential: points - target };
  });
}
