import { strokesReceivedByHole } from "@/lib/golf/scoring";
import { netScore } from "@/lib/golf/handicap";
import type { PlayerScoreInput } from "@/lib/golf/scoring";

/**
 * Nassau match-play scoring (phase 9): two sides, each one or more
 * players, best-ball per side per hole (the side's lowest gross/net
 * score on a hole is the side's score for that hole). Standard match
 * play conventions -- a hole is won, lost, or halved; the match status
 * is how many holes one side is "up," and a match can be clinched
 * early ("3&2") once the leading side is up by more than the holes
 * remaining. Presses (src/lib/golf/nassau.ts#computeMatchStatus called
 * again with a later starting hole) are just another match over a
 * shorter hole range -- there's nothing press-specific in this module,
 * the side_game_presses row only supplies which holes to run this over.
 */

export type Segment = "front" | "back" | "overall";

export function segmentHoleNumbers(segment: Segment, holeCount: number): number[] {
  const all = Array.from({ length: holeCount }, (_, i) => i + 1);
  if (segment === "front") return all.filter((h) => h <= 9);
  if (segment === "back") return all.filter((h) => h > 9);
  return all;
}

function sideScoreOnHole(
  sidePlayers: PlayerScoreInput[],
  holeNumber: number,
  metric: "gross" | "net",
): number | null {
  let best: number | null = null;
  for (const p of sidePlayers) {
    const g = p.grossByHole.get(holeNumber);
    if (g == null) continue;
    const value =
      metric === "gross" ? g : (netScore(g, strokesReceivedByHole(p.playingHandicap, p.holes).get(holeNumber) ?? null) ?? g);
    if (best === null || value < best) best = value;
  }
  return best;
}

export interface MatchHoleResult {
  holeNumber: number;
  side1Score: number | null;
  side2Score: number | null;
  winner: 1 | 2 | "halved" | null;
}

export interface MatchStatus {
  holes: MatchHoleResult[];
  /** Holes both sides have a recorded score for, in order from the start. */
  holesPlayed: number;
  /** Positive = side 1 up by this many holes; negative = side 2 up; 0 = all square. */
  status: number;
  /** True once the match is mathematically decided (leader up by more than holes remaining). */
  clinched: boolean;
  /** e.g. "3 UP thru 9", "AS thru 5", "Side 1 wins 3&2". */
  label: string;
}

/**
 * Walks the given holes in order and stops at the first hole either
 * side has no recorded score for (or once the match is clinched, since
 * remaining holes can't change the result) -- so a match in progress
 * naturally shows only what's actually been played so far.
 */
export function computeMatchStatus(
  side1Players: PlayerScoreInput[],
  side2Players: PlayerScoreInput[],
  holeNumbers: number[],
  metric: "gross" | "net",
): MatchStatus {
  const holes: MatchHoleResult[] = [];
  let status = 0;
  let clinched = false;
  let clinchedAtHolesPlayed = 0;

  for (let i = 0; i < holeNumbers.length; i++) {
    const holeNumber = holeNumbers[i];
    const s1 = sideScoreOnHole(side1Players, holeNumber, metric);
    const s2 = sideScoreOnHole(side2Players, holeNumber, metric);
    if (s1 == null || s2 == null) break;

    const winner: MatchHoleResult["winner"] = s1 < s2 ? 1 : s2 < s1 ? 2 : "halved";
    holes.push({ holeNumber, side1Score: s1, side2Score: s2, winner });
    if (winner === 1) status += 1;
    else if (winner === 2) status -= 1;

    const holesRemaining = holeNumbers.length - (i + 1);
    if (!clinched && Math.abs(status) > holesRemaining) {
      clinched = true;
      clinchedAtHolesPlayed = i + 1;
    }
    if (clinched) break;
  }

  const holesPlayed = holes.length;
  let label: string;
  if (clinched) {
    const upBy = Math.abs(status);
    const remaining = holeNumbers.length - clinchedAtHolesPlayed;
    const winningSide = status > 0 ? 1 : 2;
    label = `Side ${winningSide} wins ${upBy}${remaining > 0 ? `&${remaining}` : ""}`;
  } else if (holesPlayed === 0) {
    label = "Not started";
  } else if (status === 0) {
    label = `AS thru ${holesPlayed}`;
  } else {
    label = `Side ${status > 0 ? 1 : 2} ${Math.abs(status)} UP thru ${holesPlayed}`;
  }

  return { holes, holesPlayed, status, clinched, label };
}
