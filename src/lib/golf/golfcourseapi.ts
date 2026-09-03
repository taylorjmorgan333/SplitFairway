/**
 * Thin server-only client for GolfCourseAPI (https://golfcourseapi.com) —
 * the licensed course-data provider the user has their own account and API
 * key for. This is the one place that talks to it over HTTP, so the
 * request shape, auth header, and raw response mapping only need to be
 * right once. Everything above this file (src/lib/golf/course-provider.ts)
 * talks to the vendor-neutral CourseProvider interface instead, so a
 * second provider could be added later without touching callers.
 *
 * Verified directly against GolfCourseAPI's own published API docs
 * (https://api.golfcourseapi.com/docs/api/, rendered and read live) on
 * 2026-09-03 — not guessed, and not taken from the docs.golfcourseapi.com
 * marketing page alone. Confirmed there:
 *   - GET /v1/search?search_query=...&fuzzy_match=true — search by course
 *     or club name. Results carry only a *count* of tee boxes per gender
 *     ({ male: number, female: number }), never full tee/hole data.
 *   - GET /v1/courses/{id} — full detail for one course, including every
 *     tee box's holes (par/yardage/handicap).
 *   - Auth: `Authorization: Bearer <key>` (HTTP bearer scheme) is the
 *     documented *preferred* method — what this file uses. A legacy
 *     `Authorization: Key <key>` form is also accepted but only mentioned
 *     as being kept for existing integrations, so it's not used here.
 *   - POST /v1/courses, PATCH /v1/courses/{id} also exist, but they're
 *     "create/update a course" (contributing data back to GolfCourseAPI),
 *     require a paid Pro/Enterprise plan, and are unrelated to course
 *     lookup — this app never calls them (see course-provider.ts).
 *   - Neither GET endpoint documents a specific 429 response body, so
 *     rate-limit handling below is defensive (status code only), not
 *     shaped around an assumed error payload.
 *
 * The API key (GOLFCOURSEAPI_KEY) must be set as a server-only
 * environment variable in Vercel — never NEXT_PUBLIC_-prefixed, and never
 * passed through the client. Every function here throws
 * GolfCourseApiNotConfiguredError if it's unset, so callers can show a
 * clear "not set up yet" message instead of a raw fetch failure.
 */

const BASE_URL = "https://api.golfcourseapi.com";

/** How long a single provider request is allowed to hang before this app gives up and reports a timeout. */
const REQUEST_TIMEOUT_MS = 8_000;

export class GolfCourseApiNotConfiguredError extends Error {
  constructor() {
    super("GolfCourseAPI is not configured.");
    this.name = "GolfCourseApiNotConfiguredError";
  }
}

/**
 * A small, fixed taxonomy of *sanitized* failure reasons — safe to log
 * (course_provider_requests.sanitized_error_code) and safe to branch UI
 * copy on, unlike the raw provider status code or response body. Never
 * derived from provider response text, only from the HTTP status/outcome.
 */
export type GolfCourseApiErrorCode =
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "validation_error"
  | "rate_limited"
  | "timeout"
  | "network_error"
  | "server_error"
  | "unknown";

export class GolfCourseApiRequestError extends Error {
  constructor(
    message: string,
    public code: GolfCourseApiErrorCode,
    public status?: number,
  ) {
    super(message);
    this.name = "GolfCourseApiRequestError";
  }
}

function codeForStatus(status: number): GolfCourseApiErrorCode {
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "not_found";
  if (status === 422) return "validation_error";
  if (status === 429) return "rate_limited";
  if (status >= 500) return "server_error";
  return "unknown";
}

/** One hole's par/yardage/stroke-index for a single tee box, as GolfCourseAPI returns it. */
export interface GolfCourseApiHole {
  par: number;
  yardage: number | null;
  handicap: number | null;
}

/** One tee box's full detail — only ever returned from GET /v1/courses/{id}, never from search. */
export interface GolfCourseApiTeeBox {
  tee_name: string;
  course_rating: number | null;
  slope_rating: number | null;
  total_yards: number | null;
  total_meters: number | null;
  number_of_holes: number | null;
  par_total: number | null;
  holes: GolfCourseApiHole[];
}

export interface GolfCourseApiLocation {
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
}

/**
 * A search-result row (GET /v1/search). Deliberately a *different* type
 * from GolfCourseApiCourseDetail below — `tees` here is a count per
 * gender, not tee box data, per the docs. An earlier version of this file
 * reused the detail type for search results too (with a code comment
 * warning about it but not a type that enforced it); this split is what
 * makes that mistake impossible to reintroduce.
 */
export interface GolfCourseApiCourseSummary {
  id: string;
  club_name: string;
  course_name: string;
  scorecard_url?: string | null;
  location?: GolfCourseApiLocation | null;
  tees: {
    male: number;
    female: number;
  };
}

/** Full course detail (GET /v1/courses/{id}) — every tee box, every hole. */
export interface GolfCourseApiCourseDetail {
  id: string;
  club_name: string;
  course_name: string;
  scorecard_url?: string | null;
  location?: GolfCourseApiLocation | null;
  tees: {
    male: GolfCourseApiTeeBox[];
    female: GolfCourseApiTeeBox[];
  };
}

function apiKey(): string {
  const key = process.env.GOLFCOURSEAPI_KEY;
  if (!key) {
    throw new GolfCourseApiNotConfiguredError();
  }
  return key;
}

async function request<T>(path: string): Promise<T> {
  const key = apiKey();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      headers: { Authorization: `Bearer ${key}` },
      signal: controller.signal,
      // Course data changes essentially never; a short cache keeps a
      // flurry of searches from re-hitting the provider on every keystroke.
      next: { revalidate: 60 },
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new GolfCourseApiRequestError(
        "GolfCourseAPI took too long to respond. Try again in a moment.",
        "timeout",
      );
    }
    throw new GolfCourseApiRequestError(
      "Couldn't reach GolfCourseAPI. Try again in a moment.",
      "network_error",
    );
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    const code = codeForStatus(res.status);
    const messages: Record<GolfCourseApiErrorCode, string> = {
      unauthorized: "GolfCourseAPI rejected the configured API key.",
      forbidden: "GolfCourseAPI refused this request (plan restriction).",
      not_found: "That course couldn't be found.",
      validation_error: "GolfCourseAPI rejected the request.",
      rate_limited: "GolfCourseAPI's daily request limit has been reached.",
      timeout: "GolfCourseAPI took too long to respond. Try again in a moment.",
      network_error: "Couldn't reach GolfCourseAPI. Try again in a moment.",
      server_error: "GolfCourseAPI is temporarily unavailable. Try again shortly.",
      unknown: `GolfCourseAPI returned an unexpected error (${res.status}).`,
    };
    throw new GolfCourseApiRequestError(messages[code], code, res.status);
  }

  try {
    return (await res.json()) as T;
  } catch {
    throw new GolfCourseApiRequestError(
      "GolfCourseAPI returned a response this app couldn't understand.",
      "unknown",
      res.status,
    );
  }
}

/**
 * GET /v1/search — matches on course or club name. Results here carry
 * only a tee-box count per gender, not full hole data (per GolfCourseAPI's
 * own docs, confirmed against the live rendered API reference) — fetch a
 * course by id to get holes. `fuzzy_match` is left at the provider's
 * default (true) so short/partial names still match.
 */
export async function searchGolfCourses(query: string): Promise<GolfCourseApiCourseSummary[]> {
  const data = await request<{ courses: GolfCourseApiCourseSummary[] }>(
    `/v1/search?search_query=${encodeURIComponent(query)}`,
  );
  return data.courses ?? [];
}

/** GET /v1/courses/{id} — full tee box and hole-by-hole detail. */
export async function getGolfCourse(id: string): Promise<GolfCourseApiCourseDetail> {
  const data = await request<{ course: GolfCourseApiCourseDetail }>(
    `/v1/courses/${encodeURIComponent(id)}`,
  );
  return data.course;
}
