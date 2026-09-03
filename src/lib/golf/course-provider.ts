/**
 * Vendor-neutral course-data provider abstraction. Everything above this
 * file (src/actions/course-import.ts and friends) talks only to the
 * CourseProvider interface and the plain types below — never to
 * GolfCourseAPI's own wire shapes (GolfCourseApiCourseSummary,
 * GolfCourseApiTeeBox, ...) directly. That's what lets a second provider
 * be added later (or GolfCourseAPI swapped out) without touching the
 * import flow, scoring, or UI — only a new class implementing
 * CourseProvider, built the same way GolfCourseApiProvider is here.
 *
 * The five methods below are deliberately the app's own idea of what a
 * course provider does, not a 1:1 mirror of any one vendor's endpoints.
 * GolfCourseAPI happens to expose exactly two read operations (GET
 * /v1/search and GET /v1/courses/{id} — see golfcourseapi.ts for the full
 * documentation citation), so GolfCourseApiProvider maps getCourseDetails,
 * getCourseTeeSets, getCourseScorecard, and refreshCourse all onto the
 * same GET /v1/courses/{id} call (it already returns every tee box's
 * every hole in one response — there's nothing narrower to ask for). A
 * provider with separate endpoints for tee sets vs. full scorecards could
 * implement those methods with genuinely separate requests without any
 * caller-side change.
 */

import {
  searchGolfCourses,
  getGolfCourse,
  GolfCourseApiNotConfiguredError,
  GolfCourseApiRequestError,
  type GolfCourseApiErrorCode,
  type GolfCourseApiTeeBox,
} from "@/lib/golf/golfcourseapi";
import {
  golfCourseApiSearchResultSchema,
  golfCourseApiCourseDetailSchema,
} from "@/lib/validation/golfcourseapi";

export type CourseProviderName = "golfcourseapi";

export interface CourseSearchResult {
  provider: CourseProviderName;
  providerCourseId: string;
  clubName: string;
  courseName: string;
  city: string | null;
  state: string | null;
  country: string | null;
  /** Tee-box counts only -- this provider's search never returns full tee/hole data (see golfcourseapi.ts). */
  teeCounts: { male: number; female: number };
}

export interface HoleDetail {
  holeNumber: number;
  par: number;
  yardage: number | null;
  strokeIndex: number | null;
}

export interface TeeSetDetail {
  name: string;
  color: string | null;
  category: "male" | "female" | "unisex" | null;
  courseRating: number | null;
  slopeRating: number | null;
  totalYards: number | null;
  parTotal: number | null;
  holes: HoleDetail[];
}

export interface CourseDetail {
  provider: CourseProviderName;
  providerCourseId: string;
  clubName: string;
  courseName: string;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  teeSets: TeeSetDetail[];
}

/** Normalized, vendor-neutral error -- callers branch on `code`, never on a provider-specific status or message. */
export class CourseProviderError extends Error {
  constructor(
    message: string,
    public code: GolfCourseApiErrorCode | "not_configured",
    public status?: number,
  ) {
    super(message);
    this.name = "CourseProviderError";
  }
}

export interface CourseProvider {
  readonly name: CourseProviderName;
  searchCourses(query: string, location?: string): Promise<CourseSearchResult[]>;
  getCourseDetails(providerCourseId: string): Promise<CourseDetail>;
  getCourseTeeSets(providerCourseId: string): Promise<TeeSetDetail[]>;
  getCourseScorecard(providerCourseId: string, teeId?: string): Promise<TeeSetDetail[]>;
  refreshCourse(providerCourseId: string): Promise<CourseDetail>;
}

function toProviderError(err: unknown): CourseProviderError {
  if (err instanceof GolfCourseApiNotConfiguredError) {
    return new CourseProviderError("GolfCourseAPI is not configured.", "not_configured");
  }
  if (err instanceof GolfCourseApiRequestError) {
    return new CourseProviderError(err.message, err.code, err.status);
  }
  return new CourseProviderError("Something went wrong talking to the course provider.", "unknown");
}

/** Turns a provider tee-box's holes array (no hole-number field of its own) into 1-indexed holes in play order. */
function mapHoles(holes: { par: number; yardage: number | null; handicap: number | null }[]): HoleDetail[] {
  return holes.map((h, i) => ({
    holeNumber: i + 1,
    par: h.par,
    yardage: h.yardage,
    strokeIndex: h.handicap,
  }));
}

/**
 * Flattens GolfCourseAPI's male/female tee-box arrays into one tagged
 * list and disambiguates a tee name reused across both genders (e.g. a
 * "Blue" tee for both) so two identically-named tee sets never collide in
 * this app's own course_tee_sets, which has no separate gender column of
 * its own to fall back on for uniqueness.
 */
function flattenTeeSets(tees: {
  male: GolfCourseApiTeeBox[];
  female: GolfCourseApiTeeBox[];
}): TeeSetDetail[] {
  const tagged = [
    ...tees.male.map((tee) => ({ category: "male" as const, tee })),
    ...tees.female.map((tee) => ({ category: "female" as const, tee })),
  ];

  const nameCounts = new Map<string, number>();
  for (const { tee } of tagged) {
    nameCounts.set(tee.tee_name, (nameCounts.get(tee.tee_name) ?? 0) + 1);
  }

  return tagged.map(({ category, tee }) => ({
    name:
      (nameCounts.get(tee.tee_name) ?? 0) > 1
        ? `${tee.tee_name} (${category === "male" ? "Men's" : "Women's"})`
        : tee.tee_name,
    // GolfCourseAPI has no separate tee-color field -- tee_name (e.g.
    // "Blue") often doubles as the color in practice, but guessing that
    // programmatically risks mislabeling a name like "Members" or
    // "Forward" as a color, so this stays null for provider-imported tees
    // (see the migration comment on course_tee_sets.color). A user or
    // admin can fill it in afterward.
    color: null,
    category,
    courseRating: tee.course_rating,
    slopeRating: tee.slope_rating,
    totalYards: tee.total_yards,
    parTotal: tee.par_total,
    holes: mapHoles(tee.holes),
  }));
}

export class GolfCourseApiProvider implements CourseProvider {
  readonly name: CourseProviderName = "golfcourseapi";

  /**
   * `location` is part of the CourseProvider interface for a future
   * provider that supports it, but GolfCourseAPI's documented search
   * operation (GET /v1/search) takes only `search_query` (matched fuzzily
   * against course/club name) and `fuzzy_match` -- there is no separate
   * city/state/country filter parameter. A caller can still put a city or
   * state into `query` itself; it will only match if that text happens to
   * appear in the club or course name, same as typing it into the
   * provider's own search box would. This is a real, documented
   * limitation of this provider, not an oversight -- see the Final Report.
   */
  async searchCourses(query: string): Promise<CourseSearchResult[]> {
    try {
      const raw = await searchGolfCourses(query);
      return raw.map((r) => {
        const parsed = golfCourseApiSearchResultSchema.parse(r);
        return {
          provider: this.name,
          providerCourseId: parsed.id,
          clubName: parsed.club_name,
          courseName: parsed.course_name,
          city: parsed.location?.city ?? null,
          state: parsed.location?.state ?? null,
          country: parsed.location?.country ?? null,
          teeCounts: { male: parsed.tees.male, female: parsed.tees.female },
        };
      });
    } catch (err) {
      throw toProviderError(err);
    }
  }

  async getCourseDetails(providerCourseId: string): Promise<CourseDetail> {
    try {
      const raw = await getGolfCourse(providerCourseId);
      const parsed = golfCourseApiCourseDetailSchema.parse(raw);
      return {
        provider: this.name,
        providerCourseId: parsed.id,
        clubName: parsed.club_name,
        courseName: parsed.course_name,
        address: parsed.location?.address ?? null,
        city: parsed.location?.city ?? null,
        state: parsed.location?.state ?? null,
        country: parsed.location?.country ?? null,
        teeSets: flattenTeeSets(parsed.tees),
      };
    } catch (err) {
      throw toProviderError(err);
    }
  }

  /** GolfCourseAPI has no endpoint narrower than the full course detail -- this is a view over the same response, not a second request. */
  async getCourseTeeSets(providerCourseId: string): Promise<TeeSetDetail[]> {
    const detail = await this.getCourseDetails(providerCourseId);
    return detail.teeSets;
  }

  /** Same rationale as getCourseTeeSets -- optionally narrowed to one tee by name/color match once fetched, never by a separate request. */
  async getCourseScorecard(providerCourseId: string, teeId?: string): Promise<TeeSetDetail[]> {
    const teeSets = await this.getCourseTeeSets(providerCourseId);
    if (!teeId) return teeSets;
    return teeSets.filter((t) => t.name === teeId);
  }

  /** Identical request to getCourseDetails -- GolfCourseAPI has no separate "refresh" operation, only re-fetching the same resource. Kept as its own method so callers (and the usage log) can distinguish an explicit refresh from a first import. */
  async refreshCourse(providerCourseId: string): Promise<CourseDetail> {
    return this.getCourseDetails(providerCourseId);
  }
}

export const golfCourseApiProvider: CourseProvider = new GolfCourseApiProvider();
