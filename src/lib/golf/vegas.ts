import { strokesReceivedByHole, type PlayerScoreInput } from "@/lib/golf/scoring";
import { netScore } from "@/lib/golf/handicap";

/**
 * Vegas scoring (phase 9 follow-up): two 2-player teams. Each side's two
 * scores on a hole are appended into one two-digit number, low score
 * first (a 4 and a 5 becomes 45, not 9 or 54) -- the low team number
 * wins the hole, and the gap between the two numbers is the bet. High
 * variance by design: a bad hole for the low scorer on a team barely
 * moves the number, but a bad hole for the *high* scorer blows it up
 * (a 4/9 team is 49, not 13). Deliberately simple about scores of 10+:
 * this still multiplies the lower value by 10, which stops being a
 * clean "two digits" once a score reaches double figures -- an accepted
 * simplification rather than the "flip" house-rule some groups add for
 * blow-up holes.
 */

function valueOnHole(player: PlayerScoreInput, holeNumber: number, metric: "gross" | "net"): number | null {
  const g = player.grossByHole.get(holeNumber);
  if (g == null) return null;
  if (metric === "gross") return g;
  return netScore(g, strokesReceivedByHole(player.playingHandicap, player.holes).get(holeNumber) ?? null) ?? g;
}

function teamNumber(teamPlayers: PlayerScoreInput[], holeNumber: number, metric: "gross" | "net"): number | null {
  if (teamPlayers.length !== 2) return null;
  const values: number[] = [];
  for (const p of teamPlayers) {
    const v = valueOnHole(p, holeNumber, metric);
    if (v == null) return null;
    values.push(v);
  }
  const [a, b] = values;
  return Math.min(a, b) * 10 + Math.max(a, b);
}

export interface VegasHoleResult {
  holeNumber: number;
  side1Number: number | null;
  side2Number: number | null;
  winner: 1 | 2 | "halved" | null;
  /** Absolute gap between the two team numbers -- the hole's bet size in points. 0 when halved or not yet decided. */
  diff: number;
}

export interface VegasResult {
  holes: VegasHoleResult[];
  holesPlayed: number;
}

/** Stops at the first hole either team doesn't have both scores in for yet, same walking convention as nassau/skins. */
export function computeVegas(
  side1Players: PlayerScoreInput[],
  side2Players: PlayerScoreInput[],
  holeNumbers: number[],
  metric: "gross" | "net",
): VegasResult {
  const holes: VegasHoleResult[] = [];

  for (const holeNumber of holeNumbers) {
    const n1 = teamNumber(side1Players, holeNumber, metric);
    const n2 = teamNumber(side2Players, holeNumber, metric);
    if (n1 == null || n2 == null) break;

    const winner: VegasHoleResult["winner"] = n1 < n2 ? 1 : n2 < n1 ? 2 : "halved";
    holes.push({ holeNumber, side1Number: n1, side2Number: n2, winner, diff: Math.abs(n1 - n2) });
  }

  return { holes, holesPlayed: holes.length };
}
