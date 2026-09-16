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


/**
 * Course Handicap / Playing Handicap support (WHS formula) --
 * complements allocateStrokes above, which only allocates a playing
 * handicap someone already has across holes. This is the piece that
 * was missing: converting a golfer's portable Handicap Index into a
 * tee-specific Course Handicap. See the USGA "Calculate Course
 * Handicap and Playing Handicap" FAQ:
 * https://www.usga.org/content/usga/home-page/handicapping/world-handicap-system/world-handicap-system-usga-golf-faqs/faqs---calculate-course-handicap-and-playing-handicap.html
 *
 * Terminology (kept distinct on purpose -- see round_players and
 * course_tee_sets migrations):
 * - Handicap Index: the golfer's portable profile number
 *   (golf_profiles.handicap_index / round_players.profile_handicap_index).
 * - Course Handicap: the Handicap Index converted for one specific tee
 *   using that tee's Rating, Slope, and Par (round_players.course_handicap).
 * - Playing Handicap: the number actually used for scoring this round
 *   (round_players.playing_handicap) -- equal to Course Handicap unless
 *   a supported game format applies its own allowance (none currently
 *   do in this app -- see the Final Report) or an organizer/golfer
 *   manually overrides it (round_players.playing_handicap_source).
 */

/**
 * WHS rounding: nearest whole number, with an exact .5 rounding
 * "upward" per the USGA FAQ above -- toward positive infinity, so a
 * plus/negative Course Handicap of exactly -2.5 rounds to -2, not -3.
 * This happens to match JavaScript's native Math.round for both signs,
 * but is named and tested here so every handicap rounding call site is
 * deliberate, not an incidental reliance on a language quirk.
 */
export function roundHandicap(value: number): number {
  return Math.round(value);
}

export interface CourseHandicapInput {
  /** The golfer's Handicap Index -- null if not yet known. */
  handicapIndex: number | null;
  /** The selected tee's Slope Rating (typically 55-155, neutral 113). */
  slopeRating: number | null;
  /** The selected tee's Course Rating (typically near par). */
  courseRating: number | null;
  /** The selected tee's total par for the holes being played. */
  par: number | null;
}

/**
 * Course Handicap = Handicap Index x (Slope Rating / 113) +
 * (Course Rating - Par), rounded to the nearest whole number for net
 * scoring. Returns null -- never a fabricated number -- whenever any
 * input is missing. Callers must not substitute a neutral Slope of 113
 * or assume Course Rating equals Par when a real value is unavailable;
 * showing "Rating and slope needed" (or leaving Course Handicap blank)
 * is the correct behavior for a null result, not a silent guess.
 */
export function calculateCourseHandicap(input: CourseHandicapInput): number | null {
  const { handicapIndex, slopeRating, courseRating, par } = input;
  if (handicapIndex == null || slopeRating == null || courseRating == null || par == null) {
    return null;
  }
  const raw = handicapIndex * (slopeRating / 113) + (courseRating - par);
  return roundHandicap(raw);
}

/**
 * The subset of a round_course_snapshots tee-set entry (see
 * src/lib/golf/round-snapshot.ts and SnapshotTeeSet in
 * src/components/rounds/mobile-scorecard.tsx) that Course Handicap math
 * needs. Kept as a small structural interface here, rather than
 * importing SnapshotTeeSet from a component file into this lib module,
 * so this file has no dependency on the UI layer.
 */
export interface HandicapTeeSet {
  name: string;
  course_rating?: number | null;
  slope_rating?: number | null;
  holes?: { par: number }[] | null;
}

/** A tee set's total par, or null if it has no hole data to sum -- never assumed to equal its Course Rating. */
export function teeSetPar(tee: HandicapTeeSet | null | undefined): number | null {
  if (!tee?.holes || tee.holes.length === 0) return null;
  return tee.holes.reduce((sum, h) => sum + (h.par ?? 0), 0);
}

/** Finds a tee set by its exact snapshot name (round_players.tee_set_name matches a round_course_snapshots.tee_sets[].name entry -- see the migration comment on round_players.tee_set_name). */
export function findTeeSetByName<T extends HandicapTeeSet>(
  teeSets: readonly T[],
  name: string | null | undefined,
): T | null {
  if (!name) return null;
  return teeSets.find((t) => t.name === name) ?? null;
}

/**
 * The single call most callers actually want: given a golfer's
 * Handicap Index and their selected tee (or null if none selected/found),
 * returns the Course Handicap or null if the tee's Rating/Slope/Par
 * aren't all available. This is the one tested calculation source every
 * round_players write path (src/actions/rounds.ts) and the round setup
 * UI (for a live preview before saving) both call, so Course Handicap
 * math is never duplicated or reimplemented per call site.
 */
export function courseHandicapForTee(
  handicapIndex: number | null,
  tee: HandicapTeeSet | null | undefined,
): number | null {
  if (!tee) return null;
  return calculateCourseHandicap({
    handicapIndex,
    slopeRating: tee.slope_rating ?? null,
    courseRating: tee.course_rating ?? null,
    par: teeSetPar(tee),
  });
}
