import { allocateStrokes, netScore, type HoleStrokeIndex } from "@/lib/golf/handicap";

/**
 * The core, pure scoring engine (phase 7) that every score-consuming
 * surface builds on: the mobile scorecard's own totals/standings (which
 * used to compute gross-only totals inline -- see the "Games" footnote
 * this replaces), the live leaderboard (phase 8), and side games /
 * Nassau presses / skins (phase 9). Nothing here reads the database or
 * knows about React -- it's plain functions over plain data, so it can
 * be exercised directly in tests (phase 13) and reused identically on
 * the server (leaderboard, results) and in the client scorecard.
 *
 * Each player carries their OWN tee set's holes (see PlayerScoreInput),
 * not one holes array shared across the whole field -- golfers in the
 * same round routinely play different tees, and par and stroke index
 * can differ by tee (course_holes is modeled per tee set for exactly
 * this reason; see supabase/migrations/20260903030000_courses.sql).
 * "Hole 7" for a player on the white tees and "hole 7" for one on the
 * blue tees are only the same hole in the loose sense of golf's normal
 * routing -- their par and stroke index are looked up independently.
 *
 * Deliberately in scope here: gross/net totals, Stableford points, and
 * field-wide standings for stroke-play and Stableford formats, plus the
 * general "who had the best score on this hole" building block.
 * NOT in scope here: match-play (head-to-head, hole-by-hole
 * win/loss/halve) and skins-with-carryover -- those are game-specific
 * rules about how a result becomes a settlement, which is what phase 9
 * adds on top of the primitives here (bestScoreOnHole in particular is
 * built for skins to consume directly).
 */

export interface HoleSpec {
  holeNumber: number;
  par: number;
  strokeIndex: number | null;
}

/**
 * A player's handicap, their own tee set's holes, and the gross score
 * they've entered per hole (a hole simply absent from grossByHole, or
 * mapped to null, means "not yet entered").
 */
export interface PlayerScoreInput {
  roundPlayerId: string;
  playingHandicap: number | null;
  holes: HoleSpec[];
  grossByHole: Map<number, number | null>;
}

export interface HoleRangeTotal {
  gross: number | null;
  net: number | null;
  par: number;
  holesCompleted: number;
}

export interface PlayerTotals {
  roundPlayerId: string;
  front: HoleRangeTotal;
  back: HoleRangeTotal;
  total: HoleRangeTotal;
  /** Highest hole number with a recorded score -- e.g. a player who has
   *  only entered holes 1-7 is "thru 7", the conventional leaderboard
   *  display, even though total.holesCompleted counts non-null entries
   *  (the two differ only if a hole was skipped, which the UI otherwise
   *  has no way to represent -- thru is the more honest of the two for
   *  "how far has this player gotten"). */
  thru: number;
}

function isFront(holeNumber: number): boolean {
  return holeNumber <= 9;
}

/**
 * Strokes each hole gives this player, keyed by hole number. Thin
 * wrapper over handicap.ts#allocateStrokes so callers here don't need
 * to know about that module's HoleStrokeIndex shape.
 */
export function strokesReceivedByHole(
  playingHandicap: number | null,
  holes: HoleSpec[],
): Map<number, number | null> {
  if (playingHandicap == null) return new Map();
  const input: HoleStrokeIndex[] = holes.map((h) => ({
    holeNumber: h.holeNumber,
    strokeIndex: h.strokeIndex,
  }));
  return allocateStrokes(playingHandicap, input);
}

function sumRange(
  holes: HoleSpec[],
  grossByHole: Map<number, number | null>,
  strokesByHole: Map<number, number | null>,
  predicate: (h: HoleSpec) => boolean,
): HoleRangeTotal {
  let gross = 0;
  let net = 0;
  let par = 0;
  let completed = 0;
  let anyNetMissing = false;

  for (const h of holes) {
    if (!predicate(h)) continue;
    par += h.par;
    const g = grossByHole.get(h.holeNumber);
    if (g == null) continue;
    completed += 1;
    gross += g;
    const strokes = strokesByHole.get(h.holeNumber) ?? null;
    const n = netScore(g, strokes);
    if (n == null) {
      anyNetMissing = true;
    } else {
      net += n;
    }
  }

  return {
    gross: completed > 0 ? gross : null,
    // Falls back to gross when this player has no handicap on file
    // (strokesByHole is then empty, so every hole is net-missing) --
    // shows a real number instead of a blank net column for someone
    // who simply hasn't set a playing handicap yet.
    net: completed > 0 ? (anyNetMissing ? gross : net) : null,
    par,
    holesCompleted: completed,
  };
}

/** Gross and net front/back/total for one player, plus how far through the round they are. */
export function computePlayerTotals(player: PlayerScoreInput): PlayerTotals {
  const strokesByHole = strokesReceivedByHole(player.playingHandicap, player.holes);
  const front = sumRange(player.holes, player.grossByHole, strokesByHole, (h) => isFront(h.holeNumber));
  const back = sumRange(player.holes, player.grossByHole, strokesByHole, (h) => !isFront(h.holeNumber));
  const total = sumRange(player.holes, player.grossByHole, strokesByHole, () => true);

  let thru = 0;
  for (const h of player.holes) {
    if (player.grossByHole.get(h.holeNumber) != null && h.holeNumber > thru) {
      thru = h.holeNumber;
    }
  }

  return { roundPlayerId: player.roundPlayerId, front, back, total, thru };
}

/**
 * Stableford points for a single hole: 2 minus how many strokes net
 * score was over par, floored at 0 (so anything double-bogey-net or
 * worse scores zero) -- the standard scoring table (par = 2, birdie =
 * 3, eagle = 4, bogey = 1, double bogey or worse = 0).
 */
export function stablefordPointsForHole(net: number, par: number): number {
  return Math.max(0, 2 - (net - par));
}

/** Total Stableford points for a player, counting only holes with a recorded score. */
export function computePlayerStableford(player: PlayerScoreInput): number {
  const strokesByHole = strokesReceivedByHole(player.playingHandicap, player.holes);
  let points = 0;
  for (const h of player.holes) {
    const g = player.grossByHole.get(h.holeNumber);
    if (g == null) continue;
    const n = netScore(g, strokesByHole.get(h.holeNumber) ?? null) ?? g;
    points += stablefordPointsForHole(n, h.par);
  }
  return points;
}

export type StandingsMetric = "gross" | "net" | "stableford";

export interface StandingsEntry {
  roundPlayerId: string;
  rank: number;
  value: number;
  thru: number;
  holesCompleted: number;
}

/**
 * Field-wide standings for one metric. Ranking is competition-style
 * (ties share a rank and the next rank skips accordingly, e.g. 1, 2, 2,
 * 4) since that's how a golf leaderboard reads, not a plain row index.
 * Gross/net are ascending (lower is better); Stableford is descending
 * (higher is better). Players with no recorded score are left out
 * entirely rather than ranked last with a 0/blank value.
 */
export function computeStandings(players: PlayerScoreInput[], metric: StandingsMetric): StandingsEntry[] {
  const rows = players
    .map((p) => {
      const totals = computePlayerTotals(p);
      if (totals.total.holesCompleted === 0) return null;
      const value =
        metric === "stableford"
          ? computePlayerStableford(p)
          : metric === "net"
            ? (totals.total.net ?? 0)
            : (totals.total.gross ?? 0);
      return {
        roundPlayerId: p.roundPlayerId,
        value,
        thru: totals.thru,
        holesCompleted: totals.total.holesCompleted,
      };
    })
    .filter((r): r is Omit<StandingsEntry, "rank"> => r !== null);

  const better = metric === "stableford" ? (a: number, b: number) => b - a : (a: number, b: number) => a - b;
  rows.sort((a, b) => better(a.value, b.value));

  let rank = 0;
  let lastValue: number | null = null;
  return rows.map((row, i) => {
    if (lastValue === null || row.value !== lastValue) {
      rank = i + 1;
      lastValue = row.value;
    }
    return { ...row, rank };
  });
}

export interface BestOnHoleResult {
  roundPlayerId: string;
  value: number;
  isTie: boolean;
}

/**
 * Who had the best (lowest) gross or net score on a given hole number,
 * and whether it was a tie -- the one piece every skins-style game
 * needs (a skin is only won outright when isTie is false). Built here
 * rather than in phase 9 because it's a property of the scores
 * themselves, not of any particular game's payout rules. Each player's
 * own tee set supplies their par/stroke index for that hole number.
 */
export function bestScoreOnHole(
  players: PlayerScoreInput[],
  holeNumber: number,
  metric: "gross" | "net",
): BestOnHoleResult | null {
  const values: { roundPlayerId: string; value: number }[] = [];
  for (const p of players) {
    const g = p.grossByHole.get(holeNumber);
    if (g == null) continue;
    if (metric === "gross") {
      values.push({ roundPlayerId: p.roundPlayerId, value: g });
    } else {
      const strokes = strokesReceivedByHole(p.playingHandicap, p.holes).get(holeNumber) ?? null;
      values.push({ roundPlayerId: p.roundPlayerId, value: netScore(g, strokes) ?? g });
    }
  }
  if (values.length === 0) return null;

  const min = Math.min(...values.map((v) => v.value));
  const winners = values.filter((v) => v.value === min);
  return { roundPlayerId: winners[0].roundPlayerId, value: min, isTie: winners.length > 1 };
}
