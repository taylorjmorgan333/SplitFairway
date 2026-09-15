import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/database.types";

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
