import { describe, expect, it } from "vitest";
import { mapExternalCourse, UnusableCourseDataError } from "./course-import-mapping";
import type { CourseDetail, TeeSetDetail } from "./course-provider";

function holes(count: 9 | 18): TeeSetDetail["holes"] {
  return Array.from({ length: count }, (_, i) => ({
    holeNumber: i + 1,
    par: 4,
    yardage: 400,
    strokeIndex: (i % 18) + 1,
  }));
}

function baseCourse(overrides: Partial<CourseDetail> = {}): CourseDetail {
  return {
    provider: "golfcourseapi",
    providerCourseId: "7k2m9qb4",
    clubName: "Pinehurst Golf Club",
    courseName: "Pinehurst Golf Club",
    address: null,
    city: "Pinehurst",
    state: "NC",
    country: "United States",
    teeSets: [],
    ...overrides,
  };
}

describe("mapExternalCourse", () => {
  it("maps an 18-hole course with a single tee set", () => {
    const mapped = mapExternalCourse(
      baseCourse({
        teeSets: [
          {
            name: "Blue",
            color: null,
            category: "male",
            courseRating: 72.4,
            slopeRating: 132,
            totalYards: 6800,
            parTotal: 72,
            holes: holes(18),
          },
        ],
      }),
    );

    expect(mapped.holeCount).toBe(18);
    expect(mapped.teeSets).toHaveLength(1);
    expect(mapped.teeSets[0].holes).toHaveLength(18);
    expect(mapped.teeSets[0].courseRating).toBe(72.4);
    expect(mapped.teeSets[0].slopeRating).toBe(132);
  });

  it("maps a 9-hole course", () => {
    const mapped = mapExternalCourse(
      baseCourse({
        teeSets: [
          { name: "White", color: null, category: "unisex", courseRating: null, slopeRating: null, totalYards: null, parTotal: 36, holes: holes(9) },
        ],
      }),
    );
    expect(mapped.holeCount).toBe(9);
    expect(mapped.teeSets[0].holes).toHaveLength(9);
  });

  it("handles multiple tee sets, disambiguating a name reused across genders", () => {
    const mapped = mapExternalCourse(
      baseCourse({
        teeSets: [
          { name: "Blue", color: null, category: "male", courseRating: 72, slopeRating: 130, totalYards: 6800, parTotal: 72, holes: holes(18) },
          { name: "Blue (Men's)", color: null, category: "male", courseRating: 72, slopeRating: 130, totalYards: 6800, parTotal: 72, holes: holes(18) },
          { name: "Gold", color: null, category: "female", courseRating: 70, slopeRating: 120, totalYards: 5600, parTotal: 72, holes: holes(18) },
        ],
      }),
    );
    expect(mapped.teeSets).toHaveLength(3);
  });

  it("keeps missing rating/slope as null rather than coercing to 0", () => {
    const mapped = mapExternalCourse(
      baseCourse({
        teeSets: [
          { name: "White", color: null, category: null, courseRating: null, slopeRating: null, totalYards: null, parTotal: null, holes: holes(18) },
        ],
      }),
    );
    expect(mapped.teeSets[0].courseRating).toBeNull();
    expect(mapped.teeSets[0].slopeRating).toBeNull();
    expect(mapped.teeSets[0].totalYards).toBeNull();
  });

  it("falls back a hole's missing par to 4 (course_holes.par is NOT NULL)", () => {
    // A full 18-hole tee set (matching a real provider response) with
    // just hole 1's par missing -- a tee set with only one hole would be
    // rejected by the 9/18-hole usability filter before ever reaching
    // the per-hole par fallback this test is checking.
    const eighteenHoles = holes(18);
    // @ts-expect-error -- simulating a provider response missing par
    eighteenHoles[0].par = undefined;

    const mapped = mapExternalCourse(
      baseCourse({
        teeSets: [
          {
            name: "White",
            color: null,
            category: null,
            courseRating: null,
            slopeRating: null,
            totalYards: null,
            parTotal: null,
            holes: eighteenHoles,
          },
        ],
      }),
    );
    expect(mapped.teeSets[0].holes[0].par).toBe(4);
    expect(mapped.teeSets[0].holes).toHaveLength(18);
  });

  it("skips a tee set with an unusual hole count and throws only if none are usable", () => {
    expect(() =>
      mapExternalCourse(
        baseCourse({
          teeSets: [
            { name: "Partial", color: null, category: null, courseRating: null, slopeRating: null, totalYards: null, parTotal: null, holes: holes(9).slice(0, 5) },
          ],
        }),
      ),
    ).toThrow(UnusableCourseDataError);
  });

  it("builds a combined name when course_name differs from club_name", () => {
    const mapped = mapExternalCourse(
      baseCourse({
        clubName: "Pinehurst Resort",
        courseName: "Course No. 2",
        teeSets: [{ name: "White", color: null, category: null, courseRating: null, slopeRating: null, totalYards: null, parTotal: null, holes: holes(18) }],
      }),
    );
    expect(mapped.name).toBe("Pinehurst Resort – Course No. 2");
  });

  it("uses just the club name when course_name matches it", () => {
    const mapped = mapExternalCourse(
      baseCourse({
        clubName: "Pinehurst Golf Club",
        courseName: "Pinehurst Golf Club",
        teeSets: [{ name: "White", color: null, category: null, courseRating: null, slopeRating: null, totalYards: null, parTotal: null, holes: holes(18) }],
      }),
    );
    expect(mapped.name).toBe("Pinehurst Golf Club");
  });
});
