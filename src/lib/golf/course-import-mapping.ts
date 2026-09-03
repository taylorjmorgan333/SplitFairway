import type { GolfCourseApiCourse, GolfCourseApiTeeBox } from "@/lib/golf/golfcourseapi";

export interface MappedHole {
  holeNumber: number;
  par: number;
  yardage: number | null;
  strokeIndex: number | null;
}

export interface MappedTeeSet {
  name: string;
  holes: MappedHole[];
}

export interface MappedCourse {
  name: string;
  city: string | null;
  state: string | null;
  holeCount: 9 | 18;
  teeSets: MappedTeeSet[];
}

export class UnusableCourseDataError extends Error {
  constructor() {
    super("That course doesn't have usable tee and hole data yet.");
    this.name = "UnusableCourseDataError";
  }
}

function mapHoles(teeBox: GolfCourseApiTeeBox): MappedHole[] {
  return teeBox.holes.map((h, i) => ({
    holeNumber: i + 1,
    // GolfCourseAPI's par is required on every hole in practice; fall
    // back to 4 (the single most common par) rather than dropping the
    // hole entirely if a provider record is ever missing it, since
    // course_holes.par is NOT NULL.
    par: h.par ?? 4,
    yardage: h.yardage ?? null,
    strokeIndex: h.handicap ?? null,
  }));
}

/**
 * Maps a GolfCourseAPI course (full detail, from getGolfCourse) onto our
 * own courses/course_tee_sets/course_holes shape. Only tee boxes with
 * exactly 9 or 18 holes are usable, since course_holes.hole_number is
 * constrained 1-18 and courses.hole_count only allows 9 or 18
 * (supabase/migrations/20260903030000_courses.sql) — a provider tee box
 * with a partial or unusual hole count is skipped rather than imported
 * half-broken.
 */
export function mapExternalCourse(course: GolfCourseApiCourse): MappedCourse {
  const allTees: { gender: "male" | "female"; tee: GolfCourseApiTeeBox }[] = [
    ...(course.tees?.male ?? []).map((tee) => ({ gender: "male" as const, tee })),
    ...(course.tees?.female ?? []).map((tee) => ({ gender: "female" as const, tee })),
  ];

  const usable = allTees.filter(
    ({ tee }) => tee.holes?.length === 9 || tee.holes?.length === 18,
  );

  if (usable.length === 0) {
    throw new UnusableCourseDataError();
  }

  // Disambiguate a tee name that's reused across both gender arrays with
  // different data (e.g. a "Blue" tee for both men and women) so the
  // imported library doesn't show two identically-named tee sets.
  const nameCounts = new Map<string, number>();
  for (const { tee } of usable) {
    nameCounts.set(tee.tee_name, (nameCounts.get(tee.tee_name) ?? 0) + 1);
  }

  const teeSets: MappedTeeSet[] = usable.map(({ gender, tee }) => ({
    name:
      (nameCounts.get(tee.tee_name) ?? 0) > 1
        ? `${tee.tee_name} (${gender === "male" ? "Men's" : "Women's"})`
        : tee.tee_name,
    holes: mapHoles(tee),
  }));

  const holeCount: 9 | 18 = usable.some(({ tee }) => tee.holes.length === 18) ? 18 : 9;

  const location = course.location ?? {};
  const name =
    course.course_name && course.course_name.trim().toLowerCase() !== course.club_name.trim().toLowerCase()
      ? `${course.club_name} – ${course.course_name}`
      : course.club_name;

  return {
    name,
    city: location.city?.trim() || null,
    state: location.state?.trim() || null,
    holeCount,
    teeSets,
  };
}
