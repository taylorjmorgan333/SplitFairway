import { computeSkins } from "@/lib/golf/skins";
import { toPlayerScoreInput, type CalculatorPlayer } from "@/lib/tools/calculator-score";
import type { HoleSetup } from "@/lib/tools/sample-course";

export type SkinsHoleSummary = {
  holeNumber: number;
  winnerName: string | null;
  skinsWon: number;
  carriedOver: boolean;
};

export type SkinsPlayerTotal = {
  id: string;
  name: string;
  skins: number;
  /** Null when no per-skin value was entered. */
  amount: number | null;
};

export type SkinsSummary = {
  holes: SkinsHoleSummary[];
  totals: SkinsPlayerTotal[];
  /** Skins riding on the next hole. Greater than 1 only while a carryover is pending. */
  pendingPot: number;
};

/**
 * Public skins, using the same rules as the in-app game: lowest unique
 * score wins the hole, a tie wins nothing, and carryover (when on)
 * rolls that skin into the next hole. Scoring stops at the first hole
 * that is missing any player's score.
 */
export function summarizeSkins(input: {
  players: CalculatorPlayer[];
  holes: HoleSetup[];
  metric: "gross" | "net";
  carryover: boolean;
  valuePerSkin: number | null;
}): SkinsSummary {
  const enginePlayers = input.players.map((player) => toPlayerScoreInput(player, input.holes));
  const result = computeSkins(
    enginePlayers,
    input.holes.map((hole) => hole.holeNumber),
    input.metric,
    input.carryover,
  );
  const nameById = new Map(input.players.map((player) => [player.id, player.name]));
  const value = input.valuePerSkin != null && input.valuePerSkin > 0 ? input.valuePerSkin : null;

  return {
    holes: result.holes.map((hole) => ({
      holeNumber: hole.holeNumber,
      winnerName: hole.winnerRoundPlayerId ? (nameById.get(hole.winnerRoundPlayerId) ?? null) : null,
      skinsWon: hole.skinsWon,
      carriedOver: hole.carriedOver,
    })),
    totals: input.players.map((player) => {
      const skins = result.totalsByPlayer.get(player.id) ?? 0;
      return {
        id: player.id,
        name: player.name,
        skins,
        amount: value == null ? null : skins * value,
      };
    }),
    pendingPot: result.pendingPot,
  };
}
