import { describe, expect, it, vi, beforeEach } from "vitest";

const { searchGolfCourses, getGolfCourse } = vi.hoisted(() => ({
  searchGolfCourses: vi.fn(),
  getGolfCourse: vi.fn(),
}));

vi.mock("./golfcourseapi", async () => {
  const actual = await vi.importActual<typeof import("./golfcourseapi")>("./golfcourseapi");
  return {
    ...actual,
    searchGolfCourses,
    getGolfCourse,
  };
});

// Imported after the mock is registered so GolfCourseApiProvider picks up the mocked functions.
const { GolfCourseApiProvider } = await import("./course-provider");
const { GolfCourseApiNotConfiguredError, GolfCourseApiRequestError } = await import("./golfcourseapi");

describe("GolfCourseApiProvider", () => {
  beforeEach(() => {
    searchGolfCourses.mockReset();
    getGolfCourse.mockReset();
  });

  it("searchCourses maps provider summaries into vendor-neutral CourseSearchResult, preserving tee counts", async () => {
    searchGolfCourses.mockResolvedValue([
      {
        id: "7k2m9qb4",
        club_name: "Pinehurst Golf Club",
        course_name: "Course No. 2",
        location: { city: "Pinehurst", state: "NC", country: "United States" },
        tees: { male: 4, female: 3 },
      },
    ]);

    const provider = new GolfCourseApiProvider();
    const results = await provider.searchCourses("pinehurst");

    expect(results).toEqual([
      {
        provider: "golfcourseapi",
        providerCourseId: "7k2m9qb4",
        clubName: "Pinehurst Golf Club",
        courseName: "Course No. 2",
        city: "Pinehurst",
        state: "NC",
        country: "United States",
        teeCounts: { male: 4, female: 3 },
      },
    ]);
  });

  it("getCourseDetails flattens male/female tee arrays and disambiguates a name reused across both", async () => {
    getGolfCourse.mockResolvedValue({
      id: "7k2m9qb4",
      club_name: "Club",
      course_name: "Club",
      location: { address: "1 Golf Way", city: "Town", state: "ST", country: "US" },
      tees: {
        male: [
          {
            tee_name: "Blue",
            course_rating: 72.4,
            slope_rating: 132,
            total_yards: 6800,
            total_meters: null,
            number_of_holes: 18,
            par_total: 72,
            holes: [{ par: 4, yardage: 400, handicap: 1 }],
          },
        ],
        female: [
          {
            tee_name: "Blue",
            course_rating: 70.1,
            slope_rating: 120,
            total_yards: 5600,
            total_meters: null,
            number_of_holes: 18,
            par_total: 72,
            holes: [{ par: 4, yardage: 320, handicap: 1 }],
          },
        ],
      },
    });

    const provider = new GolfCourseApiProvider();
    const detail = await provider.getCourseDetails("7k2m9qb4");

    expect(detail.teeSets).toHaveLength(2);
    expect(detail.teeSets.map((t) => t.name).sort()).toEqual(["Blue (Men's)", "Blue (Women's)"]);
    expect(detail.teeSets.find((t) => t.category === "male")?.holes[0]).toEqual({
      holeNumber: 1,
      par: 4,
      yardage: 400,
      strokeIndex: 1,
    });
  });

  it("getCourseDetails does not disambiguate a tee name that appears only once", async () => {
    getGolfCourse.mockResolvedValue({
      id: "abc",
      club_name: "Club",
      course_name: "Club",
      tees: {
        male: [{ tee_name: "White", holes: [] }],
        female: [],
      },
    });

    const provider = new GolfCourseApiProvider();
    const detail = await provider.getCourseDetails("abc");
    expect(detail.teeSets[0].name).toBe("White");
  });

  it("getCourseTeeSets and refreshCourse are views over getCourseDetails, not separate provider calls", async () => {
    getGolfCourse.mockResolvedValue({
      id: "abc",
      club_name: "Club",
      course_name: "Club",
      tees: { male: [{ tee_name: "White", holes: [] }], female: [] },
    });

    const provider = new GolfCourseApiProvider();
    await provider.getCourseTeeSets("abc");
    await provider.refreshCourse("abc");

    expect(getGolfCourse).toHaveBeenCalledTimes(2);
    expect(getGolfCourse).toHaveBeenNthCalledWith(1, "abc");
    expect(getGolfCourse).toHaveBeenNthCalledWith(2, "abc");
  });

  it("normalizes GolfCourseApiNotConfiguredError to CourseProviderError with code not_configured", async () => {
    searchGolfCourses.mockRejectedValue(new GolfCourseApiNotConfiguredError());
    const provider = new GolfCourseApiProvider();
    await expect(provider.searchCourses("x")).rejects.toMatchObject({
      name: "CourseProviderError",
      code: "not_configured",
    });
  });

  it("normalizes GolfCourseApiRequestError, preserving its sanitized code and status", async () => {
    searchGolfCourses.mockRejectedValue(
      new GolfCourseApiRequestError("daily limit", "rate_limited", 429),
    );
    const provider = new GolfCourseApiProvider();
    await expect(provider.searchCourses("x")).rejects.toMatchObject({
      code: "rate_limited",
      status: 429,
    });
  });

  it("getCourseScorecard narrows to the matching tee by name when teeId is given", async () => {
    getGolfCourse.mockResolvedValue({
      id: "abc",
      club_name: "Club",
      course_name: "Club",
      tees: {
        male: [
          { tee_name: "White", holes: [] },
          { tee_name: "Blue", holes: [] },
        ],
        female: [],
      },
    });

    const provider = new GolfCourseApiProvider();
    const scorecard = await provider.getCourseScorecard("abc", "Blue");
    expect(scorecard).toHaveLength(1);
    expect(scorecard[0].name).toBe("Blue");
  });
});
