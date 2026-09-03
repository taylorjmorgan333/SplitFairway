import { splitEqually } from "@/lib/split";
import { computeMatchStatus } from "@/lib/golf/nassau";
import type { PlayerScoreInput } from "@/lib/golf/scoring";
import type { SkinsResult } from "@/lib/golf/skins";
import type { WolfHoleResult, WolfOrderedParticipant } from "@/lib/golf/wolf";
import type { VegasResult } from "@/lib/golf/vegas";
import type { QuotaPlayerResult } from "@/lib/golf/quota";
import type { NinesResult } from "@/lib/golf/nines";
import type { TwosResult } from "@/lib/golf/twos";

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
  /** This hole's share of the pot, once the round's per-skin value is known (0 while skinsAwarded is still 0). */
  amountCents: number;
}

export interface SkinsSettlement {
  holes: SkinsHoleSettlement[];
  /** Cents owed to (positive) or by (negative) each round_player_id. Every participant's ante is a fixed cost, so the most anyone can lose is dollarValueCents -- never more, however many skins get won. */
  netByPlayer: Map<string, number>;
  /** The full pot: dollarValueCents (one golfer's ante) times participantIds.length. */
  potCents: number;
  /** How many skins have been decided so far -- the pot splits across exactly this many. 0 means nothing's been won yet, so the pot is still untouched and netByPlayer is all zero. */
  skinsAwarded: number;
}

/**
 * A skins buy-in pot, the way it's actually played at the course: every
 * participant antes dollarValueCents once, up front, into one shared
 * pot (dollarValueCents * participantIds.length) -- NOT a per-skin
 * charge funded hole by hole. Once the round ends, the pot splits
 * across every skin actually won, proportional to how many skins each
 * golfer won, using a largest-remainder allocation so it always sums
 * to exactly potCents. That caps everyone's downside at their own
 * ante: a golfer with zero skins simply loses their ante, never more,
 * and the biggest possible win is the pot minus your own ante.
 *
 * Computed live from whatever's been scored so far, so before the
 * round finishes this is a "the pot splits this way if it ended right
 * now" projection -- the value of each skin can still shift as more
 * skins get decided.
 */
export function computeSkinsSettlement(
  result: SkinsResult,
  participantIds: string[],
  dollarValueCents: number,
): SkinsSettlement {
  const potCents = dollarValueCents * participantIds.length;
  const skinsAwarded = result.holes.reduce((sum, h) => sum + h.skinsWon, 0);
  const holes: SkinsHoleSettlement[] = [];

  if (skinsAwarded === 0) {
    // Nobody's won a skin yet, so the pot hasn't been divided --
    // report everyone flat at zero rather than guessing who'll get it.
    const netByPlayer = new Map<string, number>(participantIds.map((id) => [id, 0]));
    for (const h of result.holes) {
      if (!h.winnerRoundPlayerId || h.skinsWon <= 0) continue;
      holes.push({ holeNumber: h.holeNumber, winnerRoundPlayerId: h.winnerRoundPlayerId, skinsWon: h.skinsWon, amountCents: 0 });
    }
    return { holes, netByPlayer, potCents, skinsAwarded };
  }

  // Largest-remainder split of the pot, weighted by skins won -- the
  // weighted counterpart to splitEqually's remainder handling, so the
  // shares always add up to exactly potCents with no leftover cents.
  const winningsByPlayer = new Map<string, number>();
  const remainderByPlayer = new Map<string, number>();
  let allocatedCents = 0;
  for (const id of participantIds) {
    const skinsWon = result.totalsByPlayer.get(id) ?? 0;
    const exact = (potCents * skinsWon) / skinsAwarded;
    const floor = Math.floor(exact);
    winningsByPlayer.set(id, floor);
    remainderByPlayer.set(id, exact - floor);
    allocatedCents += floor;
  }
  let leftoverCents = potCents - allocatedCents;
  const byRemainder = [...participantIds].sort((a, b) => {
    const diff = (remainderByPlayer.get(b) ?? 0) - (remainderByPlayer.get(a) ?? 0);
    return diff !== 0 ? diff : a.localeCompare(b);
  });
  for (const id of byRemainder) {
    if (leftoverCents <= 0) break;
    winningsByPlayer.set(id, (winningsByPlayer.get(id) ?? 0) + 1);
    leftoverCents -= 1;
  }

  const netByPlayer = new Map<string, number>(
    participantIds.map((id) => [id, (winningsByPlayer.get(id) ?? 0) - dollarValueCents]),
  );

  const perSkinCents = potCents / skinsAwarded;
  for (const h of result.holes) {
    if (!h.winnerRoundPlayerId || h.skinsWon <= 0) continue;
    holes.push({
      holeNumber: h.holeNumber,
      winnerRoundPlayerId: h.winnerRoundPlayerId,
      skinsWon: h.skinsWon,
      amountCents: Math.round(perSkinCents * h.skinsWon),
    });
  }

  return { holes, netByPlayer, potCents, skinsAwarded };
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

/**
 * Rounds each player's raw (possibly fractional) cents figure independently,
 * then -- since independent per-player rounding of a set that's exactly
 * zero-sum in real numbers can drift by a cent or two once each entry is
 * rounded on its own -- corrects any drift onto whichever player has the
 * largest stake (ties broken by round_player_id, for determinism), so the
 * returned map always sums to exactly zero. Used by computeNinesSettlement,
 * the one settlement here whose inputs (points shared across a tie) aren't
 * already whole numbers the way every other game's are.
 */
function roundToZeroSum(rawCentsByPlayer: Map<string, number>): Map<string, number> {
  const rounded = new Map<string, number>();
  let sum = 0;
  for (const [id, cents] of rawCentsByPlayer) {
    const r = Math.round(cents);
    rounded.set(id, r);
    sum += r;
  }
  if (sum !== 0 && rounded.size > 0) {
    let biggestId: string | null = null;
    let biggestAbs = -1;
    for (const [id, cents] of [...rounded.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
      if (Math.abs(cents) > biggestAbs) {
        biggestAbs = Math.abs(cents);
        biggestId = id;
      }
    }
    if (biggestId !== null) {
      rounded.set(biggestId, (rounded.get(biggestId) ?? 0) - sum);
    }
  }
  return rounded;
}

export interface WolfHoleSettlement {
  holeNumber: number;
  wolfRoundPlayerId: string | null;
  partnerRoundPlayerId: string | null;
  isLoneWolf: boolean;
  outcome: WolfHoleResult["outcome"];
  /** Per-bet value for this hole (doubled when lone wolf) -- null when the hole is undecided or halved, since no money moved. */
  amountCents: number | null;
}

export interface WolfSettlement {
  holes: WolfHoleSettlement[];
  netByPlayer: Map<string, number>;
  holesDecided: number;
  holesTotal: number;
}

/**
 * Each hole is independent money (unlike Nassau, there's no running
 * match to wait on) -- every losing player on a hole pays dollarValueCents
 * to every winning player, doubled when the wolf went alone. This is
 * exactly zero-sum by construction (winners collect losers.length *
 * perBetCents each, losers pay winners.length * perBetCents each) for
 * either shape: a 2v2 partnered hole or a 1v3 lone-wolf hole.
 */
export function computeWolfSettlement(
  holeResults: WolfHoleResult[],
  order: WolfOrderedParticipant[],
  dollarValueCents: number,
): WolfSettlement {
  const netByPlayer = new Map<string, number>(order.map((o) => [o.roundPlayerId, 0]));
  const holes: WolfHoleSettlement[] = [];
  let holesDecided = 0;

  for (const h of holeResults) {
    if (h.outcome == null || !h.wolfRoundPlayerId) {
      holes.push({ ...h, amountCents: null });
      continue;
    }
    holesDecided += 1;
    if (h.outcome === "halved") {
      holes.push({ ...h, amountCents: null });
      continue;
    }

    const wolfSideIds = new Set<string>([h.wolfRoundPlayerId]);
    if (!h.isLoneWolf && h.partnerRoundPlayerId) wolfSideIds.add(h.partnerRoundPlayerId);
    const allIds = order.map((o) => o.roundPlayerId);
    const oppSideIds = allIds.filter((id) => !wolfSideIds.has(id));

    const perBetCents = h.isLoneWolf ? dollarValueCents * 2 : dollarValueCents;
    const winnerIds = h.outcome === "wolfSide" ? [...wolfSideIds] : oppSideIds;
    const loserIds = h.outcome === "wolfSide" ? oppSideIds : [...wolfSideIds];

    for (const winnerId of winnerIds) {
      netByPlayer.set(winnerId, (netByPlayer.get(winnerId) ?? 0) + perBetCents * loserIds.length);
    }
    for (const loserId of loserIds) {
      netByPlayer.set(loserId, (netByPlayer.get(loserId) ?? 0) - perBetCents * winnerIds.length);
    }

    holes.push({ ...h, amountCents: perBetCents });
  }

  return { holes, netByPlayer, holesDecided, holesTotal: holeResults.length };
}

export interface VegasHoleSettlement {
  holeNumber: number;
  side1Number: number | null;
  side2Number: number | null;
  winner: 1 | 2 | "halved" | null;
  /** Total moved on this hole (diff * dollarValueCents) -- 0 when halved or not yet decided. */
  amountCents: number;
}

export interface VegasSettlement {
  holes: VegasHoleSettlement[];
  netByPlayer: Map<string, number>;
}

/** dollarValueCents is worth per point of gap between the two team numbers -- the standard "a dollar a point" Vegas convention. */
export function computeVegasSettlement(
  result: VegasResult,
  side1PlayerIds: string[],
  side2PlayerIds: string[],
  dollarValueCents: number,
): VegasSettlement {
  const netByPlayer = new Map<string, number>([...side1PlayerIds, ...side2PlayerIds].map((id) => [id, 0]));
  const holes: VegasHoleSettlement[] = [];

  for (const h of result.holes) {
    if (h.winner === "halved" || h.winner == null || h.diff === 0) {
      holes.push({ ...h, amountCents: 0 });
      continue;
    }

    const amountCents = h.diff * dollarValueCents;
    const winners = h.winner === 1 ? side1PlayerIds : side2PlayerIds;
    const losers = h.winner === 1 ? side2PlayerIds : side1PlayerIds;
    const winnerShares = splitEqually(amountCents, winners);
    const loserShares = splitEqually(amountCents, losers);
    for (const s of winnerShares) netByPlayer.set(s.tripMemberId, (netByPlayer.get(s.tripMemberId) ?? 0) + s.amountOwedCents);
    for (const s of loserShares) netByPlayer.set(s.tripMemberId, (netByPlayer.get(s.tripMemberId) ?? 0) - s.amountOwedCents);

    holes.push({ ...h, amountCents });
  }

  return { holes, netByPlayer };
}

export interface QuotaPlayerSettlement {
  roundPlayerId: string;
  target: number;
  points: number;
  differential: number;
  beatQuota: boolean;
}

export interface QuotaSettlement {
  players: QuotaPlayerSettlement[];
  netByPlayer: Map<string, number>;
  /** True once every participant has completed every hole -- quota is an end-of-round bet, not something meaningful to part-settle mid-round. */
  fullyDecided: boolean;
  /** Total ante collected (dollarValueCents * participant count). */
  potCents: number;
}

/**
 * Ante-and-split: every participant antes dollarValueCents into a pot;
 * once the round's fully played, everyone who beat their own quota
 * splits the pot evenly, and everyone else simply loses their ante.
 * If no one beats quota, the pot is left unclaimed rather than
 * arbitrarily assigned -- netByPlayer stays all zero, same as skins'
 * pendingCents for a hole nobody's won yet.
 */
export function computeQuotaSettlement(
  results: QuotaPlayerResult[],
  holeNumbersLength: number,
  dollarValueCents: number,
): QuotaSettlement {
  const netByPlayer = new Map<string, number>(results.map((r) => [r.roundPlayerId, 0]));
  const fullyDecided = results.length > 0 && results.every((r) => r.holesCompleted === holeNumbersLength);
  const potCents = dollarValueCents * results.length;

  const players: QuotaPlayerSettlement[] = results.map((r) => ({
    roundPlayerId: r.roundPlayerId,
    target: r.target,
    points: r.points,
    differential: r.differential,
    beatQuota: r.differential > 0,
  }));

  if (fullyDecided) {
    const winners = players.filter((p) => p.beatQuota).map((p) => p.roundPlayerId);
    if (winners.length > 0) {
      for (const r of results) netByPlayer.set(r.roundPlayerId, -dollarValueCents);
      const shares = splitEqually(potCents, winners);
      for (const s of shares) netByPlayer.set(s.tripMemberId, (netByPlayer.get(s.tripMemberId) ?? 0) + s.amountOwedCents);
    }
  }

  return { players, netByPlayer, fullyDecided, potCents };
}

export interface NinesSettlement {
  netByPlayer: Map<string, number>;
  totalsByPlayer: Map<string, number>;
  holesPlayed: number;
}

/** dollarValueCents is worth per point above/below the fixed 3-point-per-hole average -- automatically zero-sum since every hole's 9 points are shared among exactly 3 players. */
export function computeNinesSettlement(
  result: NinesResult,
  participantIds: string[],
  dollarValueCents: number,
): NinesSettlement {
  const holesPlayed = result.holes.length;
  const raw = new Map<string, number>(participantIds.map((id) => [id, 0]));

  if (holesPlayed > 0) {
    const avgPoints = holesPlayed * 3;
    for (const id of participantIds) {
      const totalPoints = result.totalsByPlayer.get(id) ?? 0;
      raw.set(id, (totalPoints - avgPoints) * dollarValueCents);
    }
  }

  return { netByPlayer: roundToZeroSum(raw), totalsByPlayer: result.totalsByPlayer, holesPlayed };
}

export interface TwosHoleSettlement {
  holeNumber: number;
  winnerRoundPlayerIds: string[];
  /** Total value moving on this hole (0 if no one made a 2) -- split evenly among winners if more than one, funded evenly by everyone else. */
  amountCents: number;
}

export interface TwosSettlement {
  holes: TwosHoleSettlement[];
  netByPlayer: Map<string, number>;
}

/** dollarValueCents is worth per 2 made -- same "value the winner(s) collect, split by whoever else is in the game" convention as skins' per-skin value. */
export function computeTwosSettlement(
  result: TwosResult,
  participantIds: string[],
  dollarValueCents: number,
): TwosSettlement {
  const netByPlayer = new Map<string, number>(participantIds.map((id) => [id, 0]));
  const holes: TwosHoleSettlement[] = [];

  for (const h of result.holes) {
    const funders = participantIds.filter((id) => !h.winnerRoundPlayerIds.includes(id));
    if (h.winnerRoundPlayerIds.length === 0 || funders.length === 0) {
      holes.push({ holeNumber: h.holeNumber, winnerRoundPlayerIds: h.winnerRoundPlayerIds, amountCents: 0 });
      continue;
    }

    const winnerShares = splitEqually(dollarValueCents, h.winnerRoundPlayerIds);
    const funderShares = splitEqually(dollarValueCents, funders);
    for (const s of winnerShares) netByPlayer.set(s.tripMemberId, (netByPlayer.get(s.tripMemberId) ?? 0) + s.amountOwedCents);
    for (const s of funderShares) netByPlayer.set(s.tripMemberId, (netByPlayer.get(s.tripMemberId) ?? 0) - s.amountOwedCents);

    holes.push({ holeNumber: h.holeNumber, winnerRoundPlayerIds: h.winnerRoundPlayerIds, amountCents: dollarValueCents });
  }

  return { holes, netByPlayer };
}
