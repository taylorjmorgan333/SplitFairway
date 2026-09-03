/**
 * Playing-handicap stroke allocation, shared by the live scorecard's
 * automatic net-score display (phase 6) and, later, the game engine's
 * net-scoring formats (phase 7). Deliberately NOT a recreation of an
 * official WHS handicap-index calculation -- this only allocates a
 * playing handicap the golfer or organizer already entered across the
 * holes being played, using each hole's stroke index (which hole gets a
 * stroke first). See supabase/migrations/20260903030000_courses.sql for
 * where stroke_index comes from, and the golf profile section's
 * disclaimer ("SplitFairway does not independently verify this
 * information with the USGA") for the broader policy this follows.
 *
 * Ranks holes by stroke index rather than assuming indexes run 1-18 --
 * a 9-hole round's holes might be numbered 1-9 or carry their original
 * 1-18 indexes from an 18-hole card, and this allocation is correct
 * either way since it only cares about each hole's rank among the holes
 * actually being played.
 */

export interface HoleStrokeIndex {
  holeNumber: number;
  strokeIndex: number | null;
}

/**
 * Returns, for each input hole, how many strokes a golfer playing at
 * `playingHandicap` receives on that hole (negative for a "plus"
 * handicap, meaning they give strokes back on the hardest holes
 * instead). Holes with no stroke index return null -- there's no
 * dependable way to allocate a stroke to a hole without knowing its
 * relative difficulty, so the caller should fall back to showing gross
 * only for that hole.
 */
export function allocateStrokes(
  playingHandicap: number,
  holes: HoleStrokeIndex[],
): Map<number, number | null> {
  const result = new Map<number, number | null>();
  const ranked = holes
    .filter((h): h is HoleStrokeIndex & { strokeIndex: number } => h.strokeIndex !== null)
    .sort((a, b) => a.strokeIndex - b.strokeIndex);

  for (const h of holes) {
    if (h.strokeIndex === null) result.set(h.holeNumber, null);
  }

  const n = ranked.length;
  if (n === 0) return result;

  const rounded = Math.round(playingHandicap);
  const sign = rounded < 0 ? -1 : 1;
  const magnitude = Math.abs(rounded);
  const base = Math.floor(magnitude / n);
  const remainder = magnitude % n;

  ranked.forEach((h, rank) => {
    const strokes = base + (rank < remainder ? 1 : 0);
    result.set(h.holeNumber, sign * strokes);
  });

  return result;
}

/** Net score for one hole, or null if gross or strokes-received is unknown. */
export function netScore(gross: number | null, strokesReceived: number | null | undefined): number | null {
  if (gross === null || strokesReceived == null) return null;
  return gross - strokesReceived;
}
