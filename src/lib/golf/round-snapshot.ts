import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/database.types";
import { courseHandicapForTee, findTeeSetByName, type HandicapTeeSet } from "@/lib/golf/handicap";

/**
 * Everything the scorecard, the game engine, and every game-results
 * page read for the life of a round -- see the comment on
 * round_course_snapshots in supabase/migrations/20260903040000_rounds.sql.
 * Extracted from createRoundAction (src/actions/rounds.ts) so the fast
 * Group Round start flow (src/actions/group-rounds.ts) builds a round's
 * snapshot the exact same way instead of re-deriving this -- the two
 * flows differ in what they ask the captain before this point, never in
 * how a round's own permanent copy of the course gets built.
 */
export async function loadCourseSnapshotInput(
  supabase: SupabaseClient<Database>,
  courseId: string,
): Promise<
  | {
      ok: true;
      course: { name: string; city: string | null; state: string | null; external_source: string | null; external_id: string | null };
      teeSetsSnapshot: unknown;
    }
  | { ok: false }
> {
  const { data: course } = await supabase
    .from("courses")
    .select("id, name, city, state, external_source, external_id")
    .eq("id", courseId)
    .maybeSingle();

  if (!course) {
    return { ok: false };
  }

  const { data: teeSets } = await supabase
    .from("course_tee_sets")
    .select("id, name, color, category, course_rating, slope_rating, total_yards")
    .eq("course_id", courseId);

  const teeSetRows = teeSets ?? [];
  const { data: holes } =
    teeSetRows.length > 0
      ? await supabase
          .from("course_holes")
          .select("tee_set_id, hole_number, par, yardage, stroke_index")
          .in(
            "tee_set_id",
            teeSetRows.map((t) => t.id),
          )
      : { data: [] };
  const holeRows = holes ?? [];

  const teeSetsSnapshot = teeSetRows.map((teeSet) => ({
    name: teeSet.name,
    color: teeSet.color,
    category: teeSet.category,
    course_rating: teeSet.course_rating,
    slope_rating: teeSet.slope_rating,
    total_yards: teeSet.total_yards,
    holes: holeRows
      .filter((h) => h.tee_set_id === teeSet.id)
      .sort((a, b) => a.hole_number - b.hole_number)
      .map((h) => ({
        hole_number: h.hole_number,
        par: h.par,
        yardage: h.yardage,
        stroke_index: h.stroke_index,
      })),
  }));

  return { ok: true, course, teeSetsSnapshot };
}

/**
 * Inserts the round_course_snapshots row for a freshly created round.
 * Returns an error string on failure so the caller can decide how to
 * roll back (createRoundAction deletes the round; the fast Group Round
 * flow does the same -- see rollBackRound below).
 */
export async function insertRoundCourseSnapshot(
  supabase: SupabaseClient<Database>,
  roundId: string,
  holeCount: number,
  snapshotInput: Awaited<ReturnType<typeof loadCourseSnapshotInput>> & { ok: true },
): Promise<{ ok: true } | { ok: false }> {
  const { error } = await supabase.from("round_course_snapshots").insert({
    round_id: roundId,
    course_name: snapshotInput.course.name,
    course_city: snapshotInput.course.city,
    course_state: snapshotInput.course.state,
    hole_count: holeCount,
    tee_sets: snapshotInput.teeSetsSnapshot as Json,
    provider: snapshotInput.course.external_source,
    provider_course_id: snapshotInput.course.external_id,
  });

  return error ? { ok: false } : { ok: true };
}


/**
 * Looks up one tee set from a round's own permanent course snapshot
 * (round_course_snapshots.tee_sets -- see loadCourseSnapshotInput above)
 * by its exact snapshot name, the same name stored on
 * round_players.tee_set_name. Reading from the round's snapshot rather
 * than the live course_tee_sets table is deliberate: it is what makes a
 * round's Course Handicap calculation immune to a later course-library
 * edit or refresh (see the "Preserve historical accuracy" requirement) --
 * this always reflects the Rating/Slope/Par that was actually in effect
 * when the round was created.
 */
export async function findRoundTeeSet(
  supabase: SupabaseClient<Database>,
  roundId: string,
  teeSetName: string | null,
): Promise<HandicapTeeSet | null> {
  if (!teeSetName) return null;

  const { data: snapshot } = await supabase
    .from("round_course_snapshots")
    .select("tee_sets")
    .eq("round_id", roundId)
    .maybeSingle();

  const teeSets = (snapshot?.tee_sets as HandicapTeeSet[] | null) ?? [];
  return findTeeSetByName(teeSets, teeSetName);
}

/**
 * The one place every round_players write path (addRoundPlayerAction,
 * updateRoundPlayerAction, addNewGolferToRoundAction in
 * src/actions/rounds.ts) goes to turn a Handicap Index + a chosen tee
 * name into a Course Handicap -- so Course Handicap math is never
 * duplicated per call site, and a round's own immutable snapshot (never
 * the live course library) is always what it's computed from. Returns
 * null -- never a fabricated number -- when the tee isn't chosen yet or
 * is missing Rating/Slope/Par; callers store that null as-is rather
 * than falling back to the raw Handicap Index.
 */
export async function computeCourseHandicap(
  supabase: SupabaseClient<Database>,
  roundId: string,
  teeSetName: string | null,
  handicapIndex: number | null,
): Promise<number | null> {
  const tee = await findRoundTeeSet(supabase, roundId, teeSetName);
  return courseHandicapForTee(handicapIndex, tee);
}


/**
 * A round's own permanent snapshot tee -- deliberately looser than
 * SnapshotTeeSet (components/rounds/mobile-scorecard.tsx) so this pure
 * function works on whatever shape the caller has (round_course_snapshots.tee_sets
 * is stored as untyed jsonb) while still being fully unit-testable.
 */
export interface RefreshableTeeSet {
  name: string;
  course_rating?: number | null;
  slope_rating?: number | null;
  total_yards?: number | null;
}

/**
 * The pure half of "refresh missing tee data from the saved course"
 * (spec section 4): given a round's existing snapshot tee sets and the
 * course library's current tee sets, fills in Course Rating / Slope
 * Rating (and total yardage, if also missing) ONLY on a snapshot tee
 * that is currently missing one of them AND has a same-named match in
 * the fresh data -- matched by exact name, the only identifier
 * round_players.tee_set_name and this snapshot share (GolfCourseAPI has
 * no stable per-tee-box id of its own to prefer instead; see
 * course-import-mapping.ts#resolveRefreshedTeeRating for the equivalent
 * decision at the course-library layer). Everything else about a tee --
 * including a tee that already has Rating/Slope, even if the fresh data
 * now disagrees -- is left completely untouched, so this can never
 * silently overwrite a value a round was actually played with. Returns
 * the tee names it changed so the caller can report exactly what
 * happened and recalculate only the affected players.
 */
export function mergeMissingTeeRatings<T extends RefreshableTeeSet>(
  existingTeeSets: readonly T[],
  freshTeeSets: readonly RefreshableTeeSet[],
): { merged: T[]; updatedTeeNames: string[] } {
  const freshByName = new Map(freshTeeSets.map((t) => [t.name, t]));
  const updatedTeeNames: string[] = [];

  const merged = existingTeeSets.map((tee) => {
    const missingRating = tee.course_rating == null;
    const missingSlope = tee.slope_rating == null;
    if (!missingRating && !missingSlope) return tee;

    const fresh = freshByName.get(tee.name);
    if (!fresh) return tee;

    const nextCourseRating = missingRating && fresh.course_rating != null ? fresh.course_rating : tee.course_rating;
    const nextSlopeRating = missingSlope && fresh.slope_rating != null ? fresh.slope_rating : tee.slope_rating;
    const nextTotalYards = tee.total_yards ?? fresh.total_yards ?? null;

    if (nextCourseRating === tee.course_rating && nextSlopeRating === tee.slope_rating) {
      return tee;
    }

    updatedTeeNames.push(tee.name);
    return { ...tee, course_rating: nextCourseRating, slope_rating: nextSlopeRating, total_yards: nextTotalYards };
  });

  return { merged, updatedTeeNames };
}
