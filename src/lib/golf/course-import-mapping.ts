import type { CourseDetail, TeeSetDetail } from "@/lib/golf/course-provider";

export interface MappedHole {
  holeNumber: number;
  par: number;
  yardage: number | null;
  strokeIndex: number | null;
}

export interface MappedTeeSet {
  name: string;
  color: string | null;
  category: "male" | "female" | "unisex" | null;
  courseRating: number | null;
  slopeRating: number | null;
  totalYards: number | null;
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

function mapHoles(teeSet: TeeSetDetail): MappedHole[] {
  return teeSet.holes.map((h) => ({
    holeNumber: h.holeNumber,
    // GolfCourseAPI's par is required on every hole in practice; fall
    // back to 4 (the single most common par) rather than dropping the
    // hole entirely if a provider record is ever missing it, since
    // course_holes.par is NOT NULL.
    par: h.par ?? 4,
    yardage: h.yardage,
    strokeIndex: h.strokeIndex,
  }));
}

/**
 * Maps a provider's normalized course detail (from
 * CourseProvider#getCourseDetails -- vendor-neutral, already flattened
 * out of GolfCourseAPI's male/female split by course-provider.ts) onto
 * this app's own courses/course_tee_sets/course_holes shape. Only tee
 * sets with exactly 9 or 18 holes are usable, since course_holes.hole_number
 * is constrained 1-18 and courses.hole_count only allows 9 or 18
 * (supabase/migrations/20260903030000_courses.sql) -- a provider tee set
 * with a partial or unusual hole count is skipped rather than imported
 * half-broken. Multi-course facilities (GolfCourseAPI models each course
 * at a club as its own record with its own id) are handled naturally
 * here: mapExternalCourse is called once per selected course id, never
 * once per club, so nothing needs to disambiguate multiple courses at one
 * facility -- the user already picked a specific course from the search
 * results before this function ever runs.
 */
export function mapExternalCourse(course: CourseDetail): MappedCourse {
  const usable = course.teeSets.filter((tee) => tee.holes.length === 9 || tee.holes.length === 18);

  if (usable.length === 0) {
    throw new UnusableCourseDataError();
  }

  const teeSets: MappedTeeSet[] = usable.map((tee) => ({
    name: tee.name,
    color: tee.color,
    category: tee.category,
    courseRating: tee.courseRating,
    slopeRating: tee.slopeRating,
    totalYards: tee.totalYards,
    holes: mapHoles(tee),
  }));

  const holeCount: 9 | 18 = usable.some((tee) => tee.holes.length === 18) ? 18 : 9;

  const name =
    course.courseName && course.courseName.trim().toLowerCase() !== course.clubName.trim().toLowerCase()
      ? `${course.clubName} – ${course.courseName}`
      : course.clubName;

  return {
    name,
    city: course.city?.trim() || null,
    state: course.state?.trim() || null,
    holeCount,
    teeSets,
  };
}
