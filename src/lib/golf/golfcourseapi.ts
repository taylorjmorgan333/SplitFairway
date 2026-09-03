/**
 * Thin server-only client for GolfCourseAPI (https://golfcourseapi.com) —
 * the licensed course-data provider the user has their own account and
 * API key for. This is the one place that talks to it, so the request
 * shape, auth header, and response mapping only need to be right once.
 *
 * The API key (GOLFCOURSEAPI_KEY) must be set as a server-only
 * environment variable in Vercel — never NEXT_PUBLIC_-prefixed, and never
 * passed through the client. Every function here throws
 * GolfCourseApiNotConfiguredError if it's unset, so callers (the server
 * actions in src/actions/course-import.ts) can show a clear "not set up
 * yet" message instead of a raw fetch failure.
 */

const BASE_URL = "https://api.golfcourseapi.com";

export class GolfCourseApiNotConfiguredError extends Error {
  constructor() {
    super("GolfCourseAPI is not configured.");
    this.name = "GolfCourseApiNotConfiguredError";
  }
}

export class GolfCourseApiRequestError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = "GolfCourseApiRequestError";
  }
}

export interface GolfCourseApiHole {
  par: number;
  yardage: number | null;
  handicap: number | null;
}

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

export interface GolfCourseApiCourse {
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
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      headers: { Authorization: `Bearer ${key}` },
      // Course data changes essentially never; a short cache keeps a
      // flurry of searches from re-hitting the provider on every keystroke.
      next: { revalidate: 60 },
    });
  } catch {
    throw new GolfCourseApiRequestError("Couldn't reach GolfCourseAPI. Try again in a moment.");
  }

  if (res.status === 401) {
    throw new GolfCourseApiRequestError(
      "GolfCourseAPI rejected the configured API key.",
      401,
    );
  }
  if (!res.ok) {
    throw new GolfCourseApiRequestError(
      `GolfCourseAPI returned an unexpected error (${res.status}).`,
      res.status,
    );
  }

  return (await res.json()) as T;
}

/**
 * GET /v1/search — matches on course or club name. Results here carry
 * only a tee-box count per gender, not full hole data (per GolfCourseAPI's
 * own docs) — fetch a course by id to get holes.
 */
export async function searchGolfCourses(query: string): Promise<GolfCourseApiCourse[]> {
  const data = await request<{ courses: GolfCourseApiCourse[] }>(
    `/v1/search?search_query=${encodeURIComponent(query)}`,
  );
  return data.courses ?? [];
}

/** GET /v1/courses/{id} — full tee box and hole-by-hole detail. */
export async function getGolfCourse(id: string): Promise<GolfCourseApiCourse> {
  const data = await request<{ course: GolfCourseApiCourse }>(
    `/v1/courses/${encodeURIComponent(id)}`,
  );
  return data.course;
}
