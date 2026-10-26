import { describe, expect, it } from "vitest";
import { summarizeNassau } from "@/lib/tools/nassau-calculator";
import { holesForCount } from "@/lib/tools/sample-course";
import type { CalculatorPlayer } from "@/lib/tools/calculator-score";

function player(id: string, scores: Array<number | null>, handicap: number | null = null): CalculatorPlayer {
  return { id, name: id, playingHandicap: handicap, scores };
}

const threeHoles = holesForCount(9).slice(0, 3).map((hole, index) => ({
  ...hole,
  holeNumber: index + 1,
  par: 4,
  strokeIndex: index + 1,
}));

describe("summarizeNassau", () => {
  it("halves a three-hole match when each side wins one hole", () => {
    const matches = summarizeNassau({
      sides: [
        { name: "A", players: [player("a", [4, 4, 5])] },
        { name: "B", players: [player("b", [5, 4, 4])] },
      ],
      holes: threeHoles,
      metric: "gross",
      stakePerMatch: 5,
      pressesFromHole: [],
    });

    expect(matches).toHaveLength(1);
    expect(matches[0].result).toBe("All square");
    expect(matches[0].payout).toBeNull();
    expect(matches[0].finished).toBe(true);
  });

  it("clinches 2&1 and pays the flat segment stake", () => {
    const matches = summarizeNassau({
      sides: [
        { name: "A", players: [player("a", [3, 3, 3])] },
        { name: "B", players: [player("b", [5, 5, 5])] },
      ],
      holes: threeHoles,
      metric: "gross",
      stakePerMatch: 10,
      pressesFromHole: [],
    });

    expect(matches[0].result).toBe("A wins 2&1");
    expect(matches[0].payout).toEqual({ winnerName: "A", amount: 10 });
    expect(matches[0].holesPlayed).toBe(2);
  });

  it("uses each player's handicap on net matches", () => {
    const matches = summarizeNassau({
      sides: [
        { name: "A", players: [player("a", [5], 1)] },
        { name: "B", players: [player("b", [4], 0)] },
      ],
      holes: [threeHoles[0]],
      metric: "net",
      stakePerMatch: null,
      pressesFromHole: [],
    });

    expect(matches[0].result).toBe("All square");
  });

  it("splits an 18-hole card into front, back, overall, and a press", () => {
    const holes = holesForCount(18);
    const blanks = Array<number | null>(18).fill(null);
    const matches = summarizeNassau({
      sides: [
        { name: "A", players: [player("a", blanks)] },
        { name: "B", players: [player("b", blanks)] },
      ],
      holes,
      metric: "gross",
      stakePerMatch: null,
      pressesFromHole: [1, 10, 10],
    });

    expect(matches.map((match) => match.id)).toEqual(["front", "back", "overall", "press-10"]);
  });
});
