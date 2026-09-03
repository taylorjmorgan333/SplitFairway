"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  golfCourseApiProvider,
  CourseProviderError,
  type CourseProviderName,
} from "@/lib/golf/course-provider";
import { mapExternalCourse, UnusableCourseDataError } from "@/lib/golf/course-import-mapping";
import {
  GOLFCOURSE_API_ENABLED,
  GOLFCOURSE_API_SEARCH_ENABLED,
  GOLFCOURSE_API_REFRESH_ENABLED,
  GOLFCOURSE_API_DAILY_REQUEST_LIMIT,
} from "@/lib/config";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

const EXTERNAL_SOURCE: CourseProviderName = "golfcourseapi";

type DbClient = SupabaseClient<Database>;

function normalizeQuery(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, " ");
}

function hashQuery(normalized: string): string {
  return createHash("sha256").update(normalized).digest("hex").slice(0, 32);
}

/**
 * Best-effort usage/audit logging -- never allowed to break the calling
 * action. A logging failure here would otherwise turn "GolfCourseAPI is
 * briefly unavailable" into "the whole search silently 500s", which is a
 * worse failure mode than an incomplete admin usage dashboard.
 */
async function logProviderRequest(
  supabase: DbClient,
  userId: string | null,
  fields: {
    operation: "search" | "get_details" | "refresh";
    normalizedQueryHash?: string | null;
    externalCourseId?: string | null;
    cacheHit: boolean;
    statusCode: number | null;
    sanitizedErrorCode?: string | null;
  },
): Promise<void> {
  try {
    await supabase.from("course_provider_requests").insert({
      user_id: userId,
      provider: EXTERNAL_SOURCE,
      operation: fields.operation,
      normalized_query_hash: fields.normalizedQueryHash ?? null,
      external_course_id: fields.externalCourseId ?? null,
      cache_hit: fields.cacheHit,
      status_code: fields.statusCode,
      sanitized_error_code: fields.sanitizedErrorCode ?? null,
    });
  } catch (err) {
    console.error("logProviderRequest: failed to write usage log", err);
  }
}

/** Counts today's (UTC) provider requests that actually reached GolfCourseAPI -- cache hits and locally-blocked attempts never consumed the daily quota, so they're excluded (status_code is only set on a real provider response). */
async function usedToday(supabase: DbClient): Promise<number> {
  const startOfDayUtc = new Date();
  startOfDayUtc.setUTCHours(0, 0, 0, 0);

  const { count } = await supabase
    .from("course_provider_requests")
    .select("id", { count: "exact", head: true })
    .eq("provider", EXTERNAL_SOURCE)
    .not("status_code", "is", null)
    .gte("created_at", startOfDayUtc.toISOString());

  return count ?? 0;
}

function friendlyErrorMessage(err: CourseProviderError): string {
  switch (err.code) {
    case "not_configured":
      return "Course search isn't set up yet — add this course manually below for now.";
    case "rate_limited":
    case "forbidden":
      return "GolfCourseAPI's daily search limit has been reached for today — try again tomorrow, or add this course manually below.";
    case "timeout":
    case "network_error":
    case "server_error":
      return "Course search is temporarily unavailable — try again in a moment, or add this course manually below.";
    case "not_found":
      return "That course couldn't be found.";
    default:
      return err.message || "Something went wrong searching for courses.";
  }
}

export interface ExternalCourseSummary {
  externalId: string;
  clubName: string;
  courseName: string;
  city: string | null;
  state: string | null;
  country: string | null;
}

export interface LocalCourseSummary {
  courseId: string;
  name: string;
  city: string | null;
  state: string | null;
  holeCount: number;
  fromProvider: boolean;
}

export type SearchExternalCoursesResult =
  | { ok: true; courses: ExternalCourseSummary[]; rateLimited: false }
  | { ok: true; courses: []; rateLimited: true; message: string }
  | { ok: false; error: string };

/**
 * Searches GolfCourseAPI by name -- this supplements the existing
 * user-maintained course library (src/actions/courses.ts), it doesn't
 * replace it. A course found here still has to be imported
 * (importExternalCourseAction) before it's usable in a round; manual
 * entry via "Add a course manually" keeps working exactly as before for
 * any course the provider doesn't have, and keeps working even when this
 * feature is fully disabled (GOLFCOURSE_API_ENABLED=false) or GolfCourseAPI
 * is down.
 *
 * This is the "secure server-side endpoint" the integration spec asks
 * for: it's a Next.js Server Action rather than a separate Supabase Edge
 * Function, but it has the same properties that matter -- it only runs
 * server-side, requires an authenticated SplitFairway session (checked
 * below), never returns the provider auth header/key to the client, and
 * is the only code path in this app that's allowed to call
 * golfCourseApiProvider.
 */
export async function searchExternalCoursesAction(
  query: string,
): Promise<SearchExternalCoursesResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "You need to be signed in." };
  }

  if (!GOLFCOURSE_API_ENABLED || !GOLFCOURSE_API_SEARCH_ENABLED) {
    return {
      ok: false,
      error: "Course search isn't turned on right now — add this course manually below.",
    };
  }

  const normalized = normalizeQuery(query);
  if (normalized.length < 3) {
    return { ok: false, error: "Enter at least 3 characters to search." };
  }

  const queryHash = hashQuery(normalized);

  const used = await usedToday(supabase);
  if (used >= GOLFCOURSE_API_DAILY_REQUEST_LIMIT) {
    await logProviderRequest(supabase, user.id, {
      operation: "search",
      normalizedQueryHash: queryHash,
      cacheHit: false,
      statusCode: null,
      sanitizedErrorCode: "daily_limit_reached",
    });
    return {
      ok: true,
      courses: [],
      rateLimited: true,
      message:
        "Today's course-search limit has been reached — try again tomorrow, or add this course manually below.",
    };
  }

  try {
    const results = await golfCourseApiProvider.searchCourses(normalized);
    await logProviderRequest(supabase, user.id, {
      operation: "search",
      normalizedQueryHash: queryHash,
      cacheHit: false,
      statusCode: 200,
    });
    return {
      ok: true,
      rateLimited: false,
      courses: results.slice(0, 20).map((c) => ({
        externalId: c.providerCourseId,
        clubName: c.clubName,
        courseName: c.courseName,
        city: c.city,
        state: c.state,
        country: c.country,
      })),
    };
  } catch (err) {
    const providerError =
      err instanceof CourseProviderError
        ? err
        : new CourseProviderError("Something went wrong searching for courses.", "unknown");
    await logProviderRequest(supabase, user.id, {
      operation: "search",
      normalizedQueryHash: queryHash,
      cacheHit: false,
      statusCode: providerError.status ?? null,
      sanitizedErrorCode: providerError.code,
    });
    if (providerError.code === "rate_limited" || providerError.code === "forbidden") {
      return { ok: true, courses: [], rateLimited: true, message: friendlyErrorMessage(providerError) };
    }
    return { ok: false, error: friendlyErrorMessage(providerError) };
  }
}

/**
 * Searches this app's own already-imported/manually-entered course
 * library by name -- run alongside (and independent of) the provider
 * search above, so a course already in the library never costs a
 * provider request to find again, and search still works at all when the
 * provider is disabled, exhausted, or down. courses_select_visible RLS
 * already limits this to approved courses plus ones the caller created.
 */
export async function searchLocalCoursesAction(query: string): Promise<LocalCourseSummary[]> {
  const trimmed = query.trim();
  if (trimmed.length < 3) return [];

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("courses")
    .select("id, name, city, state, hole_count, external_source")
    .ilike("name", `%${trimmed}%`)
    .order("name", { ascending: true })
    .limit(10);

  return (data ?? []).map((c) => ({
    courseId: c.id,
    name: c.name,
    city: c.city,
    state: c.state,
    holeCount: c.hole_count,
    fromProvider: c.external_source === EXTERNAL_SOURCE,
  }));
}

export type ImportExternalCourseResult =
  | { ok: true; courseId: string; alreadyImported: boolean }
  | { ok: false; error: string };

/**
 * Imports one course from GolfCourseAPI into the shared library. Unlike a
 * manually-entered course (which starts 'pending' for admin review -- see
 * createCourseAction), an API-imported course is inserted directly as
 * 'approved': it's licensed provider data, not a golfer's own unverified
 * entry, so there's nothing for an admin to review.
 *
 * Caching: if this exact course was already imported before
 * (courses_external_source_id_key), this reuses that existing row and
 * never calls the provider at all -- satisfies both the daily-quota
 * conservation goal and GolfCourseAPI's Terms (cached data may be reused
 * "within your own application"; this app is the only application it's
 * ever used in, per the key-holder restriction reviewed in the Final
 * Report). Only the one selected course's full details are ever fetched
 * -- never every search result.
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

  if (!GOLFCOURSE_API_ENABLED) {
    return { ok: false, error: "Course import isn't turned on right now." };
  }

  const { data: existing } = await supabase
    .from("courses")
    .select("id")
    .eq("external_source", EXTERNAL_SOURCE)
    .eq("external_id", externalId)
    .maybeSingle();

  if (existing) {
    await logProviderRequest(supabase, user.id, {
      operation: "get_details",
      externalCourseId: externalId,
      cacheHit: true,
      statusCode: null,
    });
    return { ok: true, courseId: existing.id, alreadyImported: true };
  }

  const used = await usedToday(supabase);
  if (used >= GOLFCOURSE_API_DAILY_REQUEST_LIMIT) {
    await logProviderRequest(supabase, user.id, {
      operation: "get_details",
      externalCourseId: externalId,
      cacheHit: false,
      statusCode: null,
      sanitizedErrorCode: "daily_limit_reached",
    });
    return {
      ok: false,
      error: "Today's course-import limit has been reached — try again tomorrow, or add this course manually below.",
    };
  }

  let mapped;
  try {
    const course = await golfCourseApiProvider.getCourseDetails(externalId);
    await logProviderRequest(supabase, user.id, {
      operation: "get_details",
      externalCourseId: externalId,
      cacheHit: false,
      statusCode: 200,
    });
    mapped = mapExternalCourse(course);
  } catch (err) {
    if (err instanceof UnusableCourseDataError) {
      return { ok: false, error: err.message };
    }
    const providerError =
      err instanceof CourseProviderError
        ? err
        : new CourseProviderError("Something went wrong importing that course.", "unknown");
    await logProviderRequest(supabase, user.id, {
      operation: "get_details",
      externalCourseId: externalId,
      cacheHit: false,
      statusCode: providerError.status ?? null,
      sanitizedErrorCode: providerError.code,
    });
    return { ok: false, error: friendlyErrorMessage(providerError) };
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
      last_fetched_at: new Date().toISOString(),
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
      .insert({
        course_id: courseRow.id,
        name: teeSet.name,
        color: teeSet.color,
        category: teeSet.category,
        course_rating: teeSet.courseRating,
        slope_rating: teeSet.slopeRating,
        total_yards: teeSet.totalYards,
      })
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

export type RefreshExternalCourseResult =
  | { ok: true; refreshed: boolean }
  | { ok: false; error: string };

/**
 * Re-fetches a provider-imported course's tee/hole data and replaces the
 * shared library row's own tee sets and holes with it. Admin-only (the
 * integration spec reserves refresh authority the same way it reserves
 * writing provider-sourced master records at all -- courses_update_own_or_admin
 * already lets an admin edit any course; this just does that edit from
 * fresh provider data instead of a form). Never touches
 * round_course_snapshots -- every round that already exists keeps
 * showing exactly the scorecard it was created with, by design (see
 * src/actions/rounds.ts), so refreshing the shared course here can never
 * change a completed or in-progress round's results.
 */
export async function refreshExternalCourseAction(courseId: string): Promise<RefreshExternalCourseResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "You need to be signed in." };
  }

  const { data: isAdmin } = await supabase.rpc("is_app_admin");
  if (!isAdmin) {
    return { ok: false, error: "Only an admin can refresh a course from GolfCourseAPI." };
  }

  if (!GOLFCOURSE_API_ENABLED || !GOLFCOURSE_API_REFRESH_ENABLED) {
    return { ok: false, error: "Refreshing from GolfCourseAPI isn't turned on right now." };
  }

  const { data: course } = await supabase
    .from("courses")
    .select("id, external_source, external_id")
    .eq("id", courseId)
    .maybeSingle();

  if (!course || course.external_source !== EXTERNAL_SOURCE || !course.external_id) {
    return { ok: false, error: "This course wasn't imported from GolfCourseAPI." };
  }

  let mapped;
  try {
    const detail = await golfCourseApiProvider.refreshCourse(course.external_id);
    await logProviderRequest(supabase, user.id, {
      operation: "refresh",
      externalCourseId: course.external_id,
      cacheHit: false,
      statusCode: 200,
    });
    mapped = mapExternalCourse(detail);
  } catch (err) {
    const providerError =
      err instanceof CourseProviderError
        ? err
        : new CourseProviderError("Something went wrong refreshing that course.", "unknown");
    await logProviderRequest(supabase, user.id, {
      operation: "refresh",
      externalCourseId: course.external_id,
      cacheHit: false,
      statusCode: providerError.status ?? null,
      sanitizedErrorCode: providerError.code,
    });
    return { ok: false, error: friendlyErrorMessage(providerError) };
  }

  // Replace-in-place: existing tee sets cascade-delete their holes.
  await supabase.from("course_tee_sets").delete().eq("course_id", courseId);

  await supabase
    .from("courses")
    .update({
      name: mapped.name,
      city: mapped.city,
      state: mapped.state,
      hole_count: mapped.holeCount,
      last_fetched_at: new Date().toISOString(),
    })
    .eq("id", courseId);

  for (const teeSet of mapped.teeSets) {
    const { data: teeSetRow } = await supabase
      .from("course_tee_sets")
      .insert({
        course_id: courseId,
        name: teeSet.name,
        color: teeSet.color,
        category: teeSet.category,
        course_rating: teeSet.courseRating,
        slope_rating: teeSet.slopeRating,
        total_yards: teeSet.totalYards,
      })
      .select("id")
      .single();

    if (!teeSetRow) continue;

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
  revalidatePath(`/courses/${courseId}`);
  return { ok: true, refreshed: true };
}
