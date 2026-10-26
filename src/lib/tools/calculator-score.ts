import type { PlayerScoreInput } from "@/lib/golf/scoring";
import type { HoleSetup } from "@/lib/tools/sample-course";

export type CalculatorPlayer = {
  id: string;
  name: string;
  /** Null means "no handicap on file" — net games fall back to gross for that player, matching the in-app engine. */
  playingHandicap: number | null;
  /** Index 0 is hole 1. Null means the hole has not been entered. */
  scores: Array<number | null>;
};

export function toPlayerScoreInput(player: CalculatorPlayer, holes: HoleSetup[]): PlayerScoreInput {
  const grossByHole = new Map<number, number | null>();
  holes.forEach((hole, index) => {
    const score = player.scores[index];
    grossByHole.set(hole.holeNumber, score == null ? null : score);
  });

  return {
    roundPlayerId: player.id,
    playingHandicap: player.playingHandicap,
    holes: holes.map((hole) => ({
      holeNumber: hole.holeNumber,
      par: hole.par,
      strokeIndex: hole.strokeIndex,
    })),
    grossByHole,
  };
}

export function formatDollars(amount: number): string {
  return amount.toLocaleString("en-US", { style: "currency", currency: "USD" });
}
