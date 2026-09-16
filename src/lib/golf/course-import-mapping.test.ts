import { describe, expect, it } from "vitest";
import {
  mapExternalCourse,
  UnusableCourseDataError,
  ratingSourceForImportedValues,
  resolveRefreshedTeeRating,
  type ExistingTeeRatingInfo,
} from "./course-import-mapping";
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

  it("keeps a 9-hole tee's own Rating/Slope/Par independent of an 18-hole tee at the same course -- never halves or derives one from the other", () => {
    // A facility can list both a full 18-hole tee and its own separate
    // 9-hole (often "front nine only") tee record, each with its own
    // real GolfCourseAPI Rating/Slope -- spec section 9 requires the
    // 9-hole numbers come from the provider's own 9-hole record, never
    // half of the 18-hole one.
    const mapped = mapExternalCourse(
      baseCourse({
        teeSets: [
          { name: "White", color: null, category: "unisex", courseRating: 72.4, slopeRating: 132, totalYards: 6800, parTotal: 72, holes: holes(18) },
          { name: "White (9)", color: null, category: "unisex", courseRating: 34.9, slopeRating: 118, totalYards: 3100, parTotal: 35, holes: holes(9) },
        ],
      }),
    );
    // holeCount is a course-level field derived from whether *any* tee
    // has 18 holes -- it doesn't change what each individual tee set
    // keeps for its own Rating/Slope/Par.
    expect(mapped.holeCount).toBe(18);
    const eighteen = mapped.teeSets.find((t) => t.name === "White")!;
    const nine = mapped.teeSets.find((t) => t.name === "White (9)")!;
    expect(eighteen.courseRating).toBe(72.4);
    expect(eighteen.slopeRating).toBe(132);
    expect(eighteen.holes).toHaveLength(18);
    // Not half of 72.4/132 -- the provider's own distinct 9-hole numbers.
    expect(nine.courseRating).toBe(34.9);
    expect(nine.slopeRating).toBe(118);
    expect(nine.holes).toHaveLength(9);
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

  it("keeps matching-color/yardage men's and women's tees as distinct records with their own ratings (spec section 2's exact example)", () => {
    // By the time a CourseDetail reaches mapExternalCourse, gender
    // disambiguation has already happened upstream in
    // course-provider.ts#flattenTeeSets (see that file's own test for
    // the disambiguation step itself) -- this test's job is to confirm
    // mapExternalCourse then preserves "Gold (Men's)" and "Gold
    // (Women's)" as fully distinct records, each keeping its own
    // Course/Slope Rating, even though their color and yardage match.
    const mapped = mapExternalCourse(
      baseCourse({
        teeSets: [
          { name: "Gold (Men's)", color: "Gold", category: "male", courseRating: 71.4, slopeRating: 129, totalYards: 6200, parTotal: 72, holes: holes(18) },
          { name: "Gold (Women's)", color: "Gold", category: "female", courseRating: 75.8, slopeRating: 133, totalYards: 6200, parTotal: 72, holes: holes(18) },
        ],
      }),
    );
    expect(mapped.teeSets).toHaveLength(2);
    const mens = mapped.teeSets.find((t) => t.name === "Gold (Men's)");
    const womens = mapped.teeSets.find((t) => t.name === "Gold (Women's)");
    expect(mens).toBeDefined();
    expect(womens).toBeDefined();
    expect(mens!.courseRating).toBe(71.4);
    expect(mens!.slopeRating).toBe(129);
    expect(womens!.courseRating).toBe(75.8);
    expect(womens!.slopeRating).toBe(133);
    // Same color/yardage on both -- the gender-specific rating is the
    // only thing that actually differs between them.
    expect(mens!.color).toBe(womens!.color);
    expect(mens!.totalYards).toBe(womens!.totalYards);
  });

  it("keeps a tee's Course Rating when only its Slope Rating is missing, rather than dropping both", () => {
    const mapped = mapExternalCourse(
      baseCourse({
        teeSets: [
          { name: "Blue", color: null, category: null, courseRating: 72.1, slopeRating: null, totalYards: 6700, parTotal: 72, holes: holes(18) },
        ],
      }),
    );
    expect(mapped.teeSets[0].courseRating).toBe(72.1);
    expect(mapped.teeSets[0].slopeRating).toBeNull();
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


describe("ratingSourceForImportedValues", () => {
  it("stamps 'api' when the provider supplied a rating", () => {
    expect(ratingSourceForImportedValues(74.2, 141)).toBe("api");
  });

  it("stamps 'api' when only one of rating/slope is present", () => {
    expect(ratingSourceForImportedValues(74.2, null)).toBe("api");
    expect(ratingSourceForImportedValues(null, 141)).toBe("api");
  });

  it("never fabricates a source when the provider gave neither value", () => {
    expect(ratingSourceForImportedValues(null, null)).toBeNull();
  });
});

describe("resolveRefreshedTeeRating", () => {
  const manualGold: ExistingTeeRatingInfo = {
    name: "Gold (Men's)",
    course_rating: 71.9,
    slope_rating: 128,
    rating_source: "manual",
  };
  const apiBlack: ExistingTeeRatingInfo = {
    name: "Black",
    course_rating: 74.0,
    slope_rating: 139,
    rating_source: "api",
  };
  const existingByName = new Map([
    [manualGold.name, manualGold],
    [apiBlack.name, apiBlack],
  ]);

  it("preserves a manually corrected tee's rating/slope instead of the freshly fetched values", () => {
    const resolved = resolveRefreshedTeeRating(
      { name: "Gold (Men's)", courseRating: 74.2, slopeRating: 141 },
      existingByName,
    );
    expect(resolved).toEqual({
      courseRating: 71.9,
      slopeRating: 128,
      ratingSource: "manual",
      preservedManual: true,
    });
  });

  it("uses the freshly fetched values for a tee that was never manually corrected", () => {
    const resolved = resolveRefreshedTeeRating(
      { name: "Black", courseRating: 74.2, slopeRating: 141 },
      existingByName,
    );
    expect(resolved).toEqual({
      courseRating: 74.2,
      slopeRating: 141,
      ratingSource: "api",
      preservedManual: false,
    });
  });

  it("handles a brand-new tee with no existing row at all", () => {
    const resolved = resolveRefreshedTeeRating(
      { name: "Copper", courseRating: 68.1, slopeRating: 118 },
      existingByName,
    );
    expect(resolved).toEqual({
      courseRating: 68.1,
      slopeRating: 118,
      ratingSource: "api",
      preservedManual: false,
    });
  });

  it("never fabricates a source when the refreshed tee has no rating/slope and was never manual", () => {
    const resolved = resolveRefreshedTeeRating(
      { name: "Black", courseRating: null, slopeRating: null },
      new Map([[apiBlack.name, { ...apiBlack, rating_source: null }]]),
    );
    expect(resolved.ratingSource).toBeNull();
    expect(resolved.preservedManual).toBe(false);
  });
});
