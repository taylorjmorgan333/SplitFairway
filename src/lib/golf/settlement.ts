import { splitEqually } from "@/lib/split";
import { computeMatchStatus } from "@/lib/golf/nassau";
import type { PlayerScoreInput } from "@/lib/golf/scoring";
import type { SkinsResult } from "@/lib/golf/skins";

/**
 * Phase 10: turns a monetary Nassau or skins game's already-computed
 * results into a per-player net dollar figure -- who's up, who's down,
 * and by how much. Pure math, no DB, no React, same philosophy as
 * scoring.ts/nassau.ts/skins.ts. Deliberately produces a NET per
 * player rather than a prescribed set of pairwise IOUs: that's how
 * golfers actually read a money board ("Bob's up $40, Steve's down
 * $40"), and it sidesteps this app taking any position on who
 * physically pays whom -- see money-notice.ts, this app "does not
 * process, hold, or transfer any money [and] does not facilitate
 * payment between golfers."
 *
 * All money math happens in integer cents via split.ts#splitEqually
 * (the same remainder-safe split primitive the expense-splitting
 * feature uses), converting to/from the numeric(8,2) dollar_value
 * column only at the edges.
 */

export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100);
}

/** A single Nassau bet -- one of the three standard segments, or a press. Each is worth the game's full dollar_value, matching how "a $20 Nassau" is understood (three $20 bets, plus $20 per press). */
export interface NassauBetSpec {
  key: string;
  label: string;
  holeNumbers: number[];
}

export type NassauBetOutcome = "side1" | "side2" | "push" | "undecided";

export interface NassauBetSettlement {
  key: string;
  label: string;
  outcome: NassauBetOutcome;
  /** Only set when outcome is "side1" or "side2". */
  amountCents: number | null;
}

export interface NassauSettlement {
  bets: NassauBetSettlement[];
  /** Cents owed to (positive) or by (negative) each round_player_id. Only reflects decided bets. */
  netByPlayer: Map<string, number>;
  /** True once every bet has an outcome other than "undecided". */
  fullyDecided: boolean;
}

/**
 * A bet is decided once it's mathematically clinched, or once every
 * hole in its range has been played -- the same two conditions
 * computeMatchStatus already tracks. An in-progress bet (still being
 * played, not yet clinched) is reported as "undecided" and left out
 * of netByPlayer entirely, so a mid-round settlement view never shows
 * money changing hands on a bet that could still turn around.
 */
export function computeNassauSettlement(
  side1Players: PlayerScoreInput[],
  side2Players: PlayerScoreInput[],
  side1PlayerIds: string[],
  side2PlayerIds: string[],
  bets: NassauBetSpec[],
  metric: "gross" | "net",
  dollarValueCents: number,
): NassauSettlement {
  const netByPlayer = new Map<string, number>(
    [...side1PlayerIds, ...side2PlayerIds].map((id) => [id, 0]),
  );
  const results: NassauBetSettlement[] = [];
  let fullyDecided = true;

  for (const bet of bets) {
    const status = computeMatchStatus(side1Players, side2Players, bet.holeNumbers, metric);
    const decided = bet.holeNumbers.length > 0 && (status.clinched || status.holesPlayed === bet.holeNumbers.length);

    if (!decided) {
      results.push({ key: bet.key, label: bet.label, outcome: "undecided", amountCents: null });
      fullyDecided = false;
      continue;
    }

    if (status.status === 0) {
      results.push({ key: bet.key, label: bet.label, outcome: "push", amountCents: null });
      continue;
    }

    const winners = status.status > 0 ? side1PlayerIds : side2PlayerIds;
    const losers = status.status > 0 ? side2PlayerIds : side1PlayerIds;
    const winnerShares = splitEqually(dollarValueCents, winners);
    const loserShares = splitEqually(dollarValueCents, losers);
    for (const s of winnerShares) netByPlayer.set(s.tripMemberId, (netByPlayer.get(s.tripMemberId) ?? 0) + s.amountOwedCents);
    for (const s of loserShares) netByPlayer.set(s.tripMemberId, (netByPlayer.get(s.tripMemberId) ?? 0) - s.amountOwedCents);

    results.push({
      key: bet.key,
      label: bet.label,
      outcome: status.status > 0 ? "side1" : "side2",
      amountCents: dollarValueCents,
    });
  }

  return { bets: results, netByPlayer, fullyDecided };
}

export interface SkinsHoleSettlement {
  holeNumber: number;
  winnerRoundPlayerId: string;
  skinsWon: number;
  amountCents: number;
}

export interface SkinsSettlement {
  holes: SkinsHoleSettlement[];
  /** Cents owed to (positive) or by (negative) each round_player_id, from resolved holes only. */
  netByPlayer: Map<string, number>;
  /** Value still riding on tied/undecided holes at the end -- not reflected in netByPlayer since no one has won it. */
  pendingCents: number;
}

/**
 * dollarValueCents is worth per skin won (matches the "$X/skin" badge
 * already shown on the Games page), funded evenly by every OTHER
 * participant on that hole -- not an ante-per-hole model. A skin worth
 * multiple holes (carryover) is still one payout event at
 * dollarValueCents * skinsWon.
 */
export function computeSkinsSettlement(
  result: SkinsResult,
  participantIds: string[],
  dollarValueCents: number,
): SkinsSettlement {
  const netByPlayer = new Map<string, number>(participantIds.map((id) => [id, 0]));
  const holes: SkinsHoleSettlement[] = [];

  for (const h of result.holes) {
    if (!h.winnerRoundPlayerId || h.skinsWon <= 0) continue;
    const amountCents = dollarValueCents * h.skinsWon;
    const funders = participantIds.filter((id) => id !== h.winnerRoundPlayerId);
    if (funders.length === 0) continue;

    const shares = splitEqually(amountCents, funders);
    netByPlayer.set(h.winnerRoundPlayerId, (netByPlayer.get(h.winnerRoundPlayerId) ?? 0) + amountCents);
    for (const s of shares) netByPlayer.set(s.tripMemberId, (netByPlayer.get(s.tripMemberId) ?? 0) - s.amountOwedCents);

    holes.push({ holeNumber: h.holeNumber, winnerRoundPlayerId: h.winnerRoundPlayerId, skinsWon: h.skinsWon, amountCents });
  }

  const pendingCents = result.pendingPot > 1 ? dollarValueCents * (result.pendingPot - 1) : 0;

  return { holes, netByPlayer, pendingCents };
}

/** Merges any number of per-game net maps into one round-wide total per player. */
export function mergeNetMaps(maps: Map<string, number>[]): Map<string, number> {
  const merged = new Map<string, number>();
  for (const map of maps) {
    for (const [id, cents] of map) {
      merged.set(id, (merged.get(id) ?? 0) + cents);
    }
  }
  return merged;
}

/** "$20.00", never negative -- callers that need a sign prefix it themselves (see formatSignedCents). */
export function formatCents(cents: number): string {
  const dollars = Math.abs(cents) / 100;
  return `$${dollars.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** "+$20.00" / "-$20.00" / "$0.00" -- for a net-owed figure where the sign matters. */
export function formatSignedCents(cents: number): string {
  if (cents === 0) return formatCents(0);
  return `${cents > 0 ? "+" : "-"}${formatCents(cents)}`;
}
