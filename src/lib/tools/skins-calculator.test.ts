import { describe, expect, it } from "vitest";
import { summarizeSkins } from "@/lib/tools/skins-calculator";
import { holesForCount } from "@/lib/tools/sample-course";
import type { CalculatorPlayer } from "@/lib/tools/calculator-score";

function player(id: string, scores: Array<number | null>): CalculatorPlayer {
  return { id, name: id, playingHandicap: null, scores };
}

const holes = holesForCount(9).slice(0, 2);

describe("summarizeSkins", () => {
  it("carries a tied hole into the next skin", () => {
    const summary = summarizeSkins({
      players: [player("a", [4, 3]), player("b", [4, 4])],
      holes,
      metric: "gross",
      carryover: true,
      valuePerSkin: 5,
    });

    expect(summary.holes[0]).toMatchObject({ winnerName: null, skinsWon: 0, carriedOver: true });
    expect(summary.holes[1]).toMatchObject({ winnerName: "a", skinsWon: 2, carriedOver: false });
    expect(summary.totals.find((total) => total.id === "a")?.amount).toBe(10);
    expect(summary.pendingPot).toBe(1);
  });

  it("voids a tie when carryover is off", () => {
    const summary = summarizeSkins({
      players: [player("a", [4, 3]), player("b", [4, 4])],
      holes,
      metric: "gross",
      carryover: false,
      valuePerSkin: null,
    });

    expect(summary.holes[0].carriedOver).toBe(false);
    expect(summary.holes[1].skinsWon).toBe(1);
  });

  it("stops at the first hole someone has not entered", () => {
    const summary = summarizeSkins({
      players: [player("a", [4, null]), player("b", [5, 4])],
      holes,
      metric: "gross",
      carryover: true,
      valuePerSkin: null,
    });

    expect(summary.holes).toHaveLength(1);
    expect(summary.holes[0].winnerName).toBe("a");
  });
});
