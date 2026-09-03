"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  searchGolfCourses,
  getGolfCourse,
  GolfCourseApiNotConfiguredError,
  GolfCourseApiRequestError,
} from "@/lib/golf/golfcourseapi";
import { mapExternalCourse, UnusableCourseDataError } from "@/lib/golf/course-import-mapping";

const EXTERNAL_SOURCE = "golfcourseapi";

export interface ExternalCourseSummary {
  externalId: string;
  clubName: string;
  courseName: string;
  city: string | null;
  state: string | null;
  country: string | null;
}

export type SearchExternalCoursesResult =
  | { ok: true; courses: ExternalCourseSummary[] }
  | { ok: false; error: string };

/**
 * Searches GolfCourseAPI by name (course search, before Phase 7 per the
 * user's explicit request) -- this supplements the existing
 * user-maintained course library (src/actions/courses.ts), it doesn't
 * replace it. A course found here still has to be imported
 * (importExternalCourseAction) before it's usable in a round; manual
 * entry via "Add a course manually" keeps working exactly as before for
 * any course the provider doesn't have.
 */
export async function searchExternalCoursesAction(
  query: string,
): Promise<SearchExternalCoursesResult> {
  const trimmed = query.trim();
  if (trimmed.length < 2) {
    return { ok: false, error: "Enter at least 2 characters to search." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "You need to be signed in." };
  }

  try {
    const results = await searchGolfCourses(trimmed);
    return {
      ok: true,
      courses: results.slice(0, 20).map((c) => ({
        externalId: c.id,
        clubName: c.club_name,
        courseName: c.course_name,
        city: c.location?.city ?? null,
        state: c.location?.state ?? null,
        country: c.location?.country ?? null,
      })),
    };
  } catch (err) {
    if (err instanceof GolfCourseApiNotConfiguredError) {
      return {
        ok: false,
        error: "Course search isn't set up yet — add this course manually below for now.",
      };
    }
    if (err instanceof GolfCourseApiRequestError) {
      return { ok: false, error: err.message };
    }
    return { ok: false, error: "Something went wrong searching for courses." };
  }
}

export type ImportExternalCourseResult =
  | { ok: true; courseId: string; alreadyImported: boolean }
  | { ok: false; error: string };

/**
 * Imports one course from GolfCourseAPI into the shared library. Unlike
 * a manually-entered course (which starts 'pending' for admin review --
 * see createCourseAction), an API-imported course is inserted directly
 * as 'approved': it's licensed provider data, not a golfer's own
 * unverified entry, so there's nothing for an admin to review. If this
 * exact course was already imported before (courses_external_source_id_key),
 * this reuses that existing row instead of creating a duplicate.
 */
export async function importExternalCourseAction(
  externalId: string,
): Promise<ImportExternalCourseResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "You need to be signed in." };
  }

  const { data: existing } = await supabase
    .from("courses")
    .select("id")
    .eq("external_source", EXTERNAL_SOURCE)
    .eq("external_id", externalId)
    .maybeSingle();

  if (existing) {
    return { ok: true, courseId: existing.id, alreadyImported: true };
  }

  let mapped;
  try {
    const course = await getGolfCourse(externalId);
    mapped = mapExternalCourse(course);
  } catch (err) {
    if (err instanceof GolfCourseApiNotConfiguredError) {
      return { ok: false, error: "Course search isn't set up yet." };
    }
    if (err instanceof UnusableCourseDataError) {
      return { ok: false, error: err.message };
    }
    if (err instanceof GolfCourseApiRequestError) {
      return { ok: false, error: err.message };
    }
    return { ok: false, error: "Something went wrong importing that course." };
  }

  const { data: courseRow, error: courseError } = await supabase
    .from("courses")
    .insert({
      created_by: user.id,
      name: mapped.name,
      city: mapped.city,
      state: mapped.state,
      hole_count: mapped.holeCount,
      status: "approved",
      external_source: EXTERNAL_SOURCE,
      external_id: externalId,
    })
    .select("id")
    .single();

  if (courseError || !courseRow) {
    // A unique-violation here means another request imported the same
    // course a moment ago -- fetch and reuse it instead of erroring.
    const { data: raced } = await supabase
      .from("courses")
      .select("id")
      .eq("external_source", EXTERNAL_SOURCE)
      .eq("external_id", externalId)
      .maybeSingle();
    if (raced) {
      return { ok: true, courseId: raced.id, alreadyImported: true };
    }
    return { ok: false, error: "Something went wrong saving that course." };
  }

  for (const teeSet of mapped.teeSets) {
    const { data: teeSetRow, error: teeSetError } = await supabase
      .from("course_tee_sets")
      .insert({ course_id: courseRow.id, name: teeSet.name })
      .select("id")
      .single();

    if (teeSetError || !teeSetRow) {
      continue;
    }

    if (teeSet.holes.length > 0) {
      await supabase.from("course_holes").insert(
        teeSet.holes.map((h) => ({
          tee_set_id: teeSetRow.id,
          hole_number: h.holeNumber,
          par: h.par,
          yardage: h.yardage,
          stroke_index: h.strokeIndex,
        })),
      );
    }
  }

  revalidatePath("/courses");
  return { ok: true, courseId: courseRow.id, alreadyImported: false };
}
