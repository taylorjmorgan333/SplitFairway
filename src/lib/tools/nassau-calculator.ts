import { computeMatchStatus, type MatchStatus } from "@/lib/golf/nassau";
import { toPlayerScoreInput, type CalculatorPlayer } from "@/lib/tools/calculator-score";
import type { HoleSetup } from "@/lib/tools/sample-course";

export type NassauSideInput = {
  name: string;
  players: CalculatorPlayer[];
};

export type NassauMatchSummary = {
  id: string;
  label: string;
  result: string;
  leaderName: string | null;
  finished: boolean;
  holesPlayed: number;
  holesInMatch: number;
  /** Flat stake for a finished, non-halved match. Nassau pays the segment, not a per-hole amount. */
  payout: { winnerName: string; amount: number } | null;
};

export type NassauCalculatorInput = {
  sides: [NassauSideInput, NassauSideInput];
  holes: HoleSetup[];
  metric: "gross" | "net";
  /** Dollars for each match (front, back, overall, and each press). Null or 0 skips money. */
  stakePerMatch: number | null;
  /** Overall presses: a new match from this hole through the end of the round. */
  pressesFromHole: number[];
};

function describe(
  status: MatchStatus,
  segmentLength: number,
  side1: string,
  side2: string,
): { result: string; leaderName: string | null; finished: boolean } {
  if (status.holesPlayed === 0) {
    return { result: "Not started", leaderName: null, finished: false };
  }

  if (status.clinched) {
    const upBy = Math.abs(status.status);
    const remaining = segmentLength - status.holesPlayed;
    const winner = status.status > 0 ? side1 : side2;
    const margin = remaining > 0 ? `${upBy}&${remaining}` : `${upBy} up`;
    return { result: `${winner} wins ${margin}`, leaderName: winner, finished: true };
  }

  const finished = status.holesPlayed === segmentLength;
  if (status.status === 0) {
    return {
      result: finished ? "All square" : `All square thru ${status.holesPlayed}`,
      leaderName: null,
      finished,
    };
  }

  const leaderName = status.status > 0 ? side1 : side2;
  const up = Math.abs(status.status);
  return {
    result: finished ? `${leaderName} wins ${up} up` : `${leaderName} ${up} up thru ${status.holesPlayed}`,
    leaderName,
    finished,
  };
}

function summarizeSegment(
  id: string,
  label: string,
  holeNumbers: number[],
  input: NassauCalculatorInput,
): NassauMatchSummary {
  const [side1, side2] = input.sides;
  const status = computeMatchStatus(
    side1.players.map((player) => toPlayerScoreInput(player, input.holes)),
    side2.players.map((player) => toPlayerScoreInput(player, input.holes)),
    holeNumbers,
    input.metric,
  );
  const described = describe(status, holeNumbers.length, side1.name, side2.name);
  const stake = input.stakePerMatch;
  const payout =
    described.finished && described.leaderName && stake != null && stake > 0
      ? { winnerName: described.leaderName, amount: stake }
      : null;

  return {
    id,
    label,
    result: described.result,
    leaderName: described.leaderName,
    finished: described.finished,
    holesPlayed: status.holesPlayed,
    holesInMatch: holeNumbers.length,
    payout,
  };
}

/**
 * Public Nassau: best-ball within a side (the in-app rule), then match
 * play. An 18-hole card is three bets — front, back, and overall. A
 * 9-hole card is one bet. A press is another match from the chosen hole
 * through the end, which is how the in-app engine models presses.
 */
export function summarizeNassau(input: NassauCalculatorInput): NassauMatchSummary[] {
  const holeNumbers = input.holes.map((hole) => hole.holeNumber);
  const matches: NassauMatchSummary[] = [];

  if (holeNumbers.length > 9) {
    matches.push(
      summarizeSegment("front", "Front", holeNumbers.filter((hole) => hole <= 9), input),
      summarizeSegment("back", "Back", holeNumbers.filter((hole) => hole > 9), input),
      summarizeSegment("overall", "Overall", holeNumbers, input),
    );
  } else {
    matches.push(summarizeSegment("overall", "Match", holeNumbers, input));
  }

  const seen = new Set<number>();
  for (const start of input.pressesFromHole) {
    const hole = Math.round(start);
    if (hole < 2 || hole > holeNumbers.length || seen.has(hole)) continue;
    seen.add(hole);
    matches.push(
      summarizeSegment(
        `press-${hole}`,
        `Press from ${hole}`,
        holeNumbers.filter((number) => number >= hole),
        input,
      ),
    );
  }

  return matches;
}
