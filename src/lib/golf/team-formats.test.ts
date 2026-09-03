import { describe, expect, it } from "vitest";
import {
  computeTeamStrokeFormat,
  computeOneGrossOneNet,
  computeTeamAverage,
  computeLowBallHighBall,
  computeLowBallLowTotal,
  computeLowHandicapHighHandicap,
  bestBallFormula,
  worstBallFormula,
  chaChaChaFormula,
} from "./team-formats";
import type { PlayerScoreInput, HoleSpec } from "./scoring";

function holes(count: number): HoleSpec[] {
  return Array.from({ length: count }, (_, i) => ({ holeNumber: i + 1, par: 4, strokeIndex: i + 1 }));
}

/** playingHandicap === scores.length gives every hole exactly one stroke (handicap.ts#allocateStrokes: base = handicap / holeCount), the simplest way to make net differ from gross by a known, uniform amount in a test fixture. */
function makePlayer(id: string, handicap: number | null, scores: (number | null)[]): PlayerScoreInput {
  const grossByHole = new Map<number, number | null>();
  scores.forEach((g, i) => grossByHole.set(i + 1, g));
  return { roundPlayerId: id, playingHandicap: handicap, holes: holes(scores.length), grossByHole };
}

describe("computeTeamStrokeFormat", () => {
  it("best ball: each side's per-hole score is its members' lowest", () => {
    const side1 = [makePlayer("p1", 0, [4, 5, 3]), makePlayer("p2", 0, [5, 4, 4])];
    const side2 = [makePlayer("p3", 0, [5, 5, 5]), makePlayer("p4", 0, [6, 6, 6])];

    const result = computeTeamStrokeFormat(side1, side2, [1, 2, 3], "gross", bestBallFormula);

    expect(result.holes).toEqual([
      { holeNumber: 1, side1Score: 4, side2Score: 5 },
      { holeNumber: 2, side1Score: 4, side2Score: 5 },
      { holeNumber: 3, side1Score: 3, side2Score: 5 },
    ]);
    expect(result.side1Total).toBe(11);
    expect(result.side2Total).toBe(15);
    expect(result.holesPlayed).toBe(3);
  });

  it("worst ball: each side's per-hole score is its members' highest", () => {
    const side1 = [makePlayer("p1", 0, [4, 5, 3]), makePlayer("p2", 0, [5, 4, 4])];
    const side2 = [makePlayer("p3", 0, [5, 5, 5]), makePlayer("p4", 0, [6, 6, 6])];

    const result = computeTeamStrokeFormat(side1, side2, [1, 2, 3], "gross", worstBallFormula);

    expect(result.side1Total).toBe(5 + 5 + 4);
    expect(result.side2Total).toBe(6 + 6 + 6);
  });

  it("cha cha cha: the number of scores counted rotates by hole, wrapping at the side's own size", () => {
    // Two-player side: hole 1 counts the best 1, hole 2 counts both (best 2), hole 3 wraps back to best 1.
    const side1 = [makePlayer("p1", 0, [4, 5, 3]), makePlayer("p2", 0, [5, 4, 4])];
    const side2 = [makePlayer("p3", 0, [6, 6, 6]), makePlayer("p4", 0, [7, 7, 7])];

    const result = computeTeamStrokeFormat(side1, side2, [1, 2, 3], "gross", chaChaChaFormula);

    // hole1: min(4,5)=4; hole2: 5+4=9; hole3: min(3,4)=3
    expect(result.holes).toEqual([
      { holeNumber: 1, side1Score: 4, side2Score: 6 },
      { holeNumber: 2, side1Score: 9, side2Score: 13 },
      { holeNumber: 3, side1Score: 3, side2Score: 6 },
    ]);
    expect(result.side1Total).toBe(16);
  });

  it("stops at the first hole either side is missing a score for", () => {
    const side1 = [makePlayer("p1", 0, [4, 5, null])];
    const side2 = [makePlayer("p2", 0, [5, 5, 5])];

    const result = computeTeamStrokeFormat(side1, side2, [1, 2, 3], "gross", bestBallFormula);

    expect(result.holesPlayed).toBe(2);
    expect(result.holes.map((h) => h.holeNumber)).toEqual([1, 2]);
  });
});

describe("computeOneGrossOneNet", () => {
  it("combines each side's best gross and best net on every hole", () => {
    // p1: handicap 3 over 3 holes -> one stroke every hole, so net = gross - 1.
    const side1 = [makePlayer("p1", 3, [5, 5, 5]), makePlayer("p2", 0, [6, 6, 6])];
    const side2 = [makePlayer("p3", 0, [7, 7, 7]), makePlayer("p4", 0, [8, 8, 8])];

    const result = computeOneGrossOneNet(side1, side2, [1, 2, 3]);

    // side1 per hole: best gross = min(5,6) = 5; best net = min(4,6) = 4; team score = 9.
    // side2 per hole: both p3 and p4 have handicap 0, so net = gross for
    // both; best gross = min(7,8) = 7, best net = min(7,8) = 7 too -> 14.
    expect(result.holes[0]).toEqual({ holeNumber: 1, side1Score: 9, side2Score: 14 });
    expect(result.side1Total).toBe(27);
    expect(result.side2Total).toBe(42);
  });
});

describe("computeTeamAverage", () => {
  it("averages each side's members' round totals, excluding a member with no recorded score", () => {
    const side1 = [makePlayer("p1", 0, [4, 5, 6]), makePlayer("p2", 0, [5, 6, 7])];
    const side2 = [makePlayer("p3", 0, [6, 7, 7]), makePlayer("p4", 0, [null, null, null])];

    const result = computeTeamAverage(side1, side2, "gross");

    expect(result.side1Average).toBe(16.5); // (15 + 18) / 2
    expect(result.side1Count).toBe(2);
    expect(result.side2Average).toBe(20); // only p3 has a recorded total
    expect(result.side2Count).toBe(1);
  });

  it("returns null averages when a side has no recorded scores at all", () => {
    const side1 = [makePlayer("p1", 0, [null])];
    const side2 = [makePlayer("p2", 0, [4])];

    const result = computeTeamAverage(side1, side2, "gross");
    expect(result.side1Average).toBeNull();
    expect(result.side2Average).toBe(4);
  });
});

describe("computeLowBallHighBall", () => {
  it("awards one point per hole for the lower low-ball and one for the lower high-ball", () => {
    const side1 = [makePlayer("p1", 0, [4, 7]), makePlayer("p2", 0, [6, 5])];
    const side2 = [makePlayer("p3", 0, [5, 5]), makePlayer("p4", 0, [5, 5])];

    const result = computeLowBallHighBall(side1, side2, [1, 2], "gross");

    // hole1: side1 low=4 (wins), side1 high=6 vs side2 high=5 (side2 wins).
    // hole2: side1 low=5 vs side2 low=5 (halved), side1 high=7 vs side2 high=5 (side2 wins).
    expect(result.holes[0].lowBallWinner).toBe(1);
    expect(result.holes[0].highBallWinner).toBe(2);
    expect(result.holes[1].lowBallWinner).toBe("halved");
    expect(result.holes[1].highBallWinner).toBe(2);
    expect(result.side1Points).toBe(1);
    expect(result.side2Points).toBe(2);
  });

  it("stops (plays nothing) once a side doesn't have exactly two players", () => {
    const side1 = [makePlayer("p1", 0, [4])];
    const side2 = [makePlayer("p2", 0, [5]), makePlayer("p3", 0, [5])];

    const result = computeLowBallHighBall(side1, side2, [1], "gross");
    expect(result.holesPlayed).toBe(0);
  });
});

describe("computeLowBallLowTotal", () => {
  it("compares each side's single best individual total and its combined team total independently", () => {
    const side1 = [makePlayer("p1", 0, [4, 5, 6]), makePlayer("p2", 0, [7, 7, 6])];
    const side2 = [makePlayer("p3", 0, [6, 6, 6]), makePlayer("p4", 0, [6, 6, 7])];

    const result = computeLowBallLowTotal(side1, side2, "gross");

    // side1: totals 15 and 20 -> best 15, combined 35. side2: totals 18 and 19 -> best 18, combined 37.
    expect(result.side1BestIndividual).toBe(15);
    expect(result.side2BestIndividual).toBe(18);
    expect(result.lowBallWinnerSide).toBe(1);
    expect(result.side1Total).toBe(35);
    expect(result.side2Total).toBe(37);
    expect(result.lowTotalWinnerSide).toBe(1);
  });
});

describe("computeLowHandicapHighHandicap", () => {
  it("pairs each side's lower-handicap golfers against each other, and separately the higher-handicap golfers", () => {
    const side1 = [makePlayer("p1", 5, [70]), makePlayer("p2", 15, [90])];
    const side2 = [makePlayer("p3", 8, [75]), makePlayer("p4", 20, [95])];

    const result = computeLowHandicapHighHandicap(side1, side2, "gross");

    expect(result.side1LowHandicapTotal).toBe(70); // p1 (handicap 5) is side1's low-handicap golfer
    expect(result.side2LowHandicapTotal).toBe(75); // p3 (handicap 8) is side2's low-handicap golfer
    expect(result.lowHandicapWinnerSide).toBe(1);
    expect(result.side1HighHandicapTotal).toBe(90);
    expect(result.side2HighHandicapTotal).toBe(95);
    expect(result.highHandicapWinnerSide).toBe(1);
  });

  it("returns nulls when a side doesn't have exactly two players", () => {
    const side1 = [makePlayer("p1", 5, [70])];
    const side2 = [makePlayer("p3", 8, [75]), makePlayer("p4", 20, [95])];

    const result = computeLowHandicapHighHandicap(side1, side2, "gross");
    expect(result.lowHandicapWinnerSide).toBeNull();
    expect(result.highHandicapWinnerSide).toBeNull();
  });
});
