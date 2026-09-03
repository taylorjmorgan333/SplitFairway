import { strokesReceivedByHole, computePlayerTotals, type PlayerScoreInput } from "@/lib/golf/scoring";
import { netScore } from "@/lib/golf/handicap";

/**
 * Shared scoring engine for the "two sides, some aggregation formula
 * over each side's individual hole scores" formats added alongside
 * Nassau/Vegas (games/game-type-picker.tsx Batch 1): Best Ball, Worst
 * Ball, Shamble, and Lone Ranger are all literally the same formula
 * (a side's score on a hole is its members' best -- or, for Lone
 * Ranger, worst-of-none-else-to-compare-to -- score) with only the
 * participant shape and display copy differing; Cha Cha Cha is the same
 * shape with a formula whose selected-count rotates by hole. Unlike
 * Nassau (match play -- who's up how many holes) these are scored
 * stroke play -- cumulative team totals over the holes played, lower
 * wins -- since that's the more common way groups actually settle them.
 * One Gross One Net, Team Average, Low Ball/High Ball, Low Ball/Low
 * Total, and Low Handicap/High Handicap don't fit that single shape
 * (mixed metrics, round-level rather than hole-by-hole, or two
 * independent point categories) so each gets its own small function
 * below instead of forcing it through the generic formula.
 */

function playerValueOnHole(player: PlayerScoreInput, holeNumber: number, metric: "gross" | "net"): number | null {
  const g = player.grossByHole.get(holeNumber);
  if (g == null) return null;
  if (metric === "gross") return g;
  return netScore(g, strokesReceivedByHole(player.playingHandicap, player.holes).get(holeNumber) ?? null) ?? g;
}

function playerTotal(player: PlayerScoreInput, metric: "gross" | "net"): number | null {
  const t = computePlayerTotals(player).total;
  return metric === "gross" ? t.gross : t.net;
}

/**
 * A team-aggregation formula: given one side's player values on a hole
 * (order not meaningful) plus that hole's position in the side's own
 * rotation (0-based, wraps at the side's own player count), returns the
 * side's score for the hole.
 */
export type TeamFormula = (values: number[], cycleIndex: number) => number;

export const bestBallFormula: TeamFormula = (values) => Math.min(...values);
export const worstBallFormula: TeamFormula = (values) => Math.max(...values);

/** Sum of the (cycleIndex + 1) lowest scores, capped at the side's size -- hole 1 of a rotation counts only the single best score, hole 2 counts the best two, and so on before wrapping back to one. */
export const chaChaChaFormula: TeamFormula = (values, cycleIndex) => {
  const n = Math.min(cycleIndex + 1, values.length);
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.slice(0, n).reduce((sum, v) => sum + v, 0);
};

function teamValueOnHole(
  sidePlayers: PlayerScoreInput[],
  holeNumber: number,
  metric: "gross" | "net",
  formula: TeamFormula,
): number | null {
  const values: number[] = [];
  for (const p of sidePlayers) {
    const v = playerValueOnHole(p, holeNumber, metric);
    if (v == null) return null;
    values.push(v);
  }
  if (values.length === 0) return null;
  const cycleIndex = (holeNumber - 1) % sidePlayers.length;
  return formula(values, cycleIndex);
}

export interface TeamStrokeHoleResult {
  holeNumber: number;
  side1Score: number;
  side2Score: number;
}

export interface TeamStrokeResult {
  holes: TeamStrokeHoleResult[];
  holesPlayed: number;
  side1Total: number;
  side2Total: number;
}

/** Stops at the first hole either side doesn't have a full set of scores for yet, same walking convention as nassau/vegas. */
export function computeTeamStrokeFormat(
  side1Players: PlayerScoreInput[],
  side2Players: PlayerScoreInput[],
  holeNumbers: number[],
  metric: "gross" | "net",
  formula: TeamFormula,
): TeamStrokeResult {
  const holes: TeamStrokeHoleResult[] = [];
  let side1Total = 0;
  let side2Total = 0;

  for (const holeNumber of holeNumbers) {
    const s1 = teamValueOnHole(side1Players, holeNumber, metric, formula);
    const s2 = teamValueOnHole(side2Players, holeNumber, metric, formula);
    if (s1 == null || s2 == null) break;
    holes.push({ holeNumber, side1Score: s1, side2Score: s2 });
    side1Total += s1;
    side2Total += s2;
  }

  return { holes, holesPlayed: holes.length, side1Total, side2Total };
}

/** One Gross One Net's formula needs both metrics on the same hole at once -- each side's per-hole score is its members' best gross plus its members' best net -- so it doesn't fit the single-metric TeamFormula shape above. */
export function computeOneGrossOneNet(
  side1Players: PlayerScoreInput[],
  side2Players: PlayerScoreInput[],
  holeNumbers: number[],
): TeamStrokeResult {
  function sideValue(sidePlayers: PlayerScoreInput[], holeNumber: number): number | null {
    const grossValues: number[] = [];
    const netValues: number[] = [];
    for (const p of sidePlayers) {
      const g = playerValueOnHole(p, holeNumber, "gross");
      const n = playerValueOnHole(p, holeNumber, "net");
      if (g == null || n == null) return null;
      grossValues.push(g);
      netValues.push(n);
    }
    if (grossValues.length === 0) return null;
    return Math.min(...grossValues) + Math.min(...netValues);
  }

  const holes: TeamStrokeHoleResult[] = [];
  let side1Total = 0;
  let side2Total = 0;
  for (const holeNumber of holeNumbers) {
    const s1 = sideValue(side1Players, holeNumber);
    const s2 = sideValue(side2Players, holeNumber);
    if (s1 == null || s2 == null) break;
    holes.push({ holeNumber, side1Score: s1, side2Score: s2 });
    side1Total += s1;
    side2Total += s2;
  }
  return { holes, holesPlayed: holes.length, side1Total, side2Total };
}

/** Team Average: each side's number is the average of its own members' round totals, not a hole-by-hole running score -- lower average wins. A member with no recorded score yet is excluded from their side's average rather than treated as zero. */
export interface TeamAverageResult {
  side1Average: number | null;
  side2Average: number | null;
  side1Count: number;
  side2Count: number;
}

export function computeTeamAverage(
  side1Players: PlayerScoreInput[],
  side2Players: PlayerScoreInput[],
  metric: "gross" | "net",
): TeamAverageResult {
  function sideAverage(players: PlayerScoreInput[]): { average: number | null; count: number } {
    const totals = players.map((p) => playerTotal(p, metric)).filter((v): v is number => v != null);
    if (totals.length === 0) return { average: null, count: 0 };
    return { average: totals.reduce((s, v) => s + v, 0) / totals.length, count: totals.length };
  }
  const s1 = sideAverage(side1Players);
  const s2 = sideAverage(side2Players);
  return { side1Average: s1.average, side2Average: s2.average, side1Count: s1.count, side2Count: s2.count };
}

/** Low Ball / High Ball: exactly two players per side. Two independent 1-point categories each hole -- low ball compares each side's better (lower) score, high ball compares each side's worse (higher) score; the lower number wins the point either way. */
export interface LowHighBallHoleResult {
  holeNumber: number;
  side1Low: number;
  side2Low: number;
  side1High: number;
  side2High: number;
  lowBallWinner: 1 | 2 | "halved";
  highBallWinner: 1 | 2 | "halved";
}

export interface LowHighBallResult {
  holes: LowHighBallHoleResult[];
  holesPlayed: number;
  side1Points: number;
  side2Points: number;
}

export function computeLowBallHighBall(
  side1Players: PlayerScoreInput[],
  side2Players: PlayerScoreInput[],
  holeNumbers: number[],
  metric: "gross" | "net",
): LowHighBallResult {
  const holes: LowHighBallHoleResult[] = [];
  let side1Points = 0;
  let side2Points = 0;

  for (const holeNumber of holeNumbers) {
    if (side1Players.length !== 2 || side2Players.length !== 2) break;
    const v1 = side1Players.map((p) => playerValueOnHole(p, holeNumber, metric));
    const v2 = side2Players.map((p) => playerValueOnHole(p, holeNumber, metric));
    if (v1.some((v) => v == null) || v2.some((v) => v == null)) break;
    const s1 = v1 as number[];
    const s2 = v2 as number[];
    const side1Low = Math.min(...s1);
    const side2Low = Math.min(...s2);
    const side1High = Math.max(...s1);
    const side2High = Math.max(...s2);
    const lowBallWinner: 1 | 2 | "halved" = side1Low < side2Low ? 1 : side2Low < side1Low ? 2 : "halved";
    const highBallWinner: 1 | 2 | "halved" = side1High < side2High ? 1 : side2High < side1High ? 2 : "halved";
    if (lowBallWinner === 1) side1Points += 1;
    else if (lowBallWinner === 2) side2Points += 1;
    if (highBallWinner === 1) side1Points += 1;
    else if (highBallWinner === 2) side2Points += 1;
    holes.push({ holeNumber, side1Low, side2Low, side1High, side2High, lowBallWinner, highBallWinner });
  }

  return { holes, holesPlayed: holes.length, side1Points, side2Points };
}

/** Low Ball / Low Total: two round-level prizes, not scored hole by hole -- the single lowest individual round total between the two sides, and the lowest combined (summed) team total. */
export interface LowBallLowTotalResult {
  lowBallWinnerSide: 1 | 2 | "halved" | null;
  side1BestIndividual: number | null;
  side2BestIndividual: number | null;
  lowTotalWinnerSide: 1 | 2 | "halved" | null;
  side1Total: number | null;
  side2Total: number | null;
}

function sideBestIndividualAndTotal(
  players: PlayerScoreInput[],
  metric: "gross" | "net",
): { best: number | null; total: number | null } {
  const totals = players.map((p) => playerTotal(p, metric)).filter((v): v is number => v != null);
  if (totals.length === 0) return { best: null, total: null };
  return { best: Math.min(...totals), total: totals.reduce((s, v) => s + v, 0) };
}

export function computeLowBallLowTotal(
  side1Players: PlayerScoreInput[],
  side2Players: PlayerScoreInput[],
  metric: "gross" | "net",
): LowBallLowTotalResult {
  const s1 = sideBestIndividualAndTotal(side1Players, metric);
  const s2 = sideBestIndividualAndTotal(side2Players, metric);

  const lowBallWinnerSide: LowBallLowTotalResult["lowBallWinnerSide"] =
    s1.best == null || s2.best == null ? null : s1.best < s2.best ? 1 : s2.best < s1.best ? 2 : "halved";
  const lowTotalWinnerSide: LowBallLowTotalResult["lowTotalWinnerSide"] =
    s1.total == null || s2.total == null ? null : s1.total < s2.total ? 1 : s2.total < s1.total ? 2 : "halved";

  return {
    lowBallWinnerSide,
    side1BestIndividual: s1.best,
    side2BestIndividual: s2.best,
    lowTotalWinnerSide,
    side1Total: s1.total,
    side2Total: s2.total,
  };
}

/** Low Handicap / High Handicap: exactly two players per side, paired by handicap rather than by score -- the lower-handicap player on each side face off, and separately the higher-handicap players do. A missing playing handicap is treated as scratch (0), same fallback scoring.ts's net columns use. */
export interface LowHighHandicapResult {
  lowHandicapWinnerSide: 1 | 2 | "halved" | null;
  side1LowHandicapTotal: number | null;
  side2LowHandicapTotal: number | null;
  highHandicapWinnerSide: 1 | 2 | "halved" | null;
  side1HighHandicapTotal: number | null;
  side2HighHandicapTotal: number | null;
}

function splitByHandicap(players: PlayerScoreInput[]): { low: PlayerScoreInput; high: PlayerScoreInput } | null {
  if (players.length !== 2) return null;
  const [a, b] = players;
  const aHcp = a.playingHandicap ?? 0;
  const bHcp = b.playingHandicap ?? 0;
  return aHcp <= bHcp ? { low: a, high: b } : { low: b, high: a };
}

export function computeLowHandicapHighHandicap(
  side1Players: PlayerScoreInput[],
  side2Players: PlayerScoreInput[],
  metric: "gross" | "net",
): LowHighHandicapResult {
  const s1 = splitByHandicap(side1Players);
  const s2 = splitByHandicap(side2Players);
  if (!s1 || !s2) {
    return {
      lowHandicapWinnerSide: null,
      side1LowHandicapTotal: null,
      side2LowHandicapTotal: null,
      highHandicapWinnerSide: null,
      side1HighHandicapTotal: null,
      side2HighHandicapTotal: null,
    };
  }

  const lowT1 = playerTotal(s1.low, metric);
  const lowT2 = playerTotal(s2.low, metric);
  const highT1 = playerTotal(s1.high, metric);
  const highT2 = playerTotal(s2.high, metric);

  const lowHandicapWinnerSide: LowHighHandicapResult["lowHandicapWinnerSide"] =
    lowT1 == null || lowT2 == null ? null : lowT1 < lowT2 ? 1 : lowT2 < lowT1 ? 2 : "halved";
  const highHandicapWinnerSide: LowHighHandicapResult["highHandicapWinnerSide"] =
    highT1 == null || highT2 == null ? null : highT1 < highT2 ? 1 : highT2 < highT1 ? 2 : "halved";

  return {
    lowHandicapWinnerSide,
    side1LowHandicapTotal: lowT1,
    side2LowHandicapTotal: lowT2,
    highHandicapWinnerSide,
    side1HighHandicapTotal: highT1,
    side2HighHandicapTotal: highT2,
  };
}
