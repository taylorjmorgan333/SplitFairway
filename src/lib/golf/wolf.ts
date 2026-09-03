import { bestScoreOnHole, type PlayerScoreInput } from "@/lib/golf/scoring";

/**
 * Wolf scoring (phase 9 follow-up): 4 players, a fixed hitting order
 * that rotates who's "the wolf" hole by hole. After watching the other
 * three tee off, the wolf either picks one as a partner (2v2, best-ball
 * per side) or goes it alone against the other three ("lone wolf").
 * Everything here is read straight from the two things
 * supabase/migrations/20260903090100_side_games_wolf_vegas_quota_nines_twos.sql
 * actually stores -- the fixed order (wolf_order) and each hole's pick
 * (side_game_wolf_picks) -- combined with the same hole_scores every
 * other game reads from. Built on scoring.ts#bestScoreOnHole for the
 * best-ball comparison, same as nassau.ts.
 */

export interface WolfOrderedParticipant {
  roundPlayerId: string;
  /** 0-3, fixed for the whole game. */
  wolfOrder: number;
}

export interface WolfPickInput {
  holeNumber: number;
  /** Null exactly when isLoneWolf is true. */
  partnerRoundPlayerId: string | null;
  isLoneWolf: boolean;
}

/** Whose turn it is to be wolf on a given hole -- rotates through the fixed order every 4 holes, starting from hole 1 regardless of the round's actual hole count or start. */
export function wolfForHole(order: WolfOrderedParticipant[], holeNumber: number): string | null {
  const idx = (holeNumber - 1) % 4;
  return order.find((o) => o.wolfOrder === idx)?.roundPlayerId ?? null;
}

export type WolfHoleOutcome = "wolfSide" | "oppSide" | "halved";

export interface WolfHoleResult {
  holeNumber: number;
  wolfRoundPlayerId: string | null;
  partnerRoundPlayerId: string | null;
  isLoneWolf: boolean;
  /** Null when the hole isn't fully scored yet, or the wolf hasn't made a pick for it yet. */
  outcome: WolfHoleOutcome | null;
}

/**
 * Walks every hole (not stopping at the first undecided one, unlike
 * nassau/skins) since a missing pick on an early hole shouldn't hide
 * results on later holes the wolf already recorded -- each hole is
 * independent in Wolf, there's no running match state to protect.
 */
export function computeWolfHoles(
  order: WolfOrderedParticipant[],
  picks: WolfPickInput[],
  players: PlayerScoreInput[],
  holeNumbers: number[],
  metric: "gross" | "net",
): WolfHoleResult[] {
  const pickByHole = new Map(picks.map((p) => [p.holeNumber, p]));
  const playerById = new Map(players.map((p) => [p.roundPlayerId, p]));

  return holeNumbers.map((holeNumber) => {
    const wolfId = wolfForHole(order, holeNumber);
    const pick = pickByHole.get(holeNumber);

    if (!wolfId || !pick) {
      return { holeNumber, wolfRoundPlayerId: wolfId, partnerRoundPlayerId: null, isLoneWolf: false, outcome: null };
    }

    const wolfSideIds = new Set<string>([wolfId]);
    if (!pick.isLoneWolf && pick.partnerRoundPlayerId) wolfSideIds.add(pick.partnerRoundPlayerId);

    const wolfSidePlayers = order
      .map((o) => playerById.get(o.roundPlayerId))
      .filter((p): p is PlayerScoreInput => !!p && wolfSideIds.has(p.roundPlayerId));
    const oppSidePlayers = order
      .map((o) => playerById.get(o.roundPlayerId))
      .filter((p): p is PlayerScoreInput => !!p && !wolfSideIds.has(p.roundPlayerId));

    const wolfScore = bestScoreOnHole(wolfSidePlayers, holeNumber, metric)?.value ?? null;
    const oppScore = bestScoreOnHole(oppSidePlayers, holeNumber, metric)?.value ?? null;

    let outcome: WolfHoleOutcome | null = null;
    if (wolfScore != null && oppScore != null) {
      outcome = wolfScore < oppScore ? "wolfSide" : oppScore < wolfScore ? "oppSide" : "halved";
    }

    return {
      holeNumber,
      wolfRoundPlayerId: wolfId,
      partnerRoundPlayerId: pick.isLoneWolf ? null : pick.partnerRoundPlayerId,
      isLoneWolf: pick.isLoneWolf,
      outcome,
    };
  });
}
