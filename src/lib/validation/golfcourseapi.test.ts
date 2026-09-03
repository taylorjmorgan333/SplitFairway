import { describe, expect, it } from "vitest";
import {
  golfCourseApiSearchResponseSchema,
  golfCourseApiCourseDetailResponseSchema,
} from "./golfcourseapi";

describe("golfCourseApiSearchResponseSchema", () => {
  it("accepts a well-formed search response with tee counts (not tee arrays)", () => {
    const parsed = golfCourseApiSearchResponseSchema.parse({
      courses: [
        {
          id: "7k2m9qb4",
          club_name: "Murray Golf Club",
          course_name: "Course No. 1",
          location: { city: "Murray", state: "KY", country: "United States" },
          tees: { male: 4, female: 3 },
        },
      ],
    });
    expect(parsed.courses[0].tees).toEqual({ male: 4, female: 3 });
  });

  it("defaults missing/null optional fields instead of throwing", () => {
    const parsed = golfCourseApiSearchResponseSchema.parse({
      courses: [{ id: "abc12345", club_name: "Club", course_name: "Club" }],
    });
    expect(parsed.courses[0].location).toBeFalsy();
    expect(parsed.courses[0].tees).toEqual({ male: 0, female: 0 });
    expect(parsed.courses[0].scorecard_url).toBeNull();
  });

  it("rejects a course missing its required id", () => {
    expect(() =>
      golfCourseApiSearchResponseSchema.parse({
        courses: [{ club_name: "Club", course_name: "Club" }],
      }),
    ).toThrow();
  });

  it("tolerates a missing courses array entirely", () => {
    const parsed = golfCourseApiSearchResponseSchema.parse({});
    expect(parsed.courses).toEqual([]);
  });
});

describe("golfCourseApiCourseDetailResponseSchema", () => {
  it("parses full tee box detail, never coercing a missing rating/slope to 0", () => {
    const parsed = golfCourseApiCourseDetailResponseSchema.parse({
      course: {
        id: "7k2m9qb4",
        club_name: "Murray Golf Club",
        course_name: "Course No. 1",
        location: { city: "Murray", state: "KY" },
        tees: {
          male: [
            {
              tee_name: "Blue",
              course_rating: null,
              slope_rating: null,
              total_yards: 6348,
              total_meters: null,
              number_of_holes: 18,
              par_total: 73,
              holes: [{ par: 4, yardage: 484, handicap: 9 }],
            },
          ],
          female: [],
        },
      },
    });

    expect(parsed.course.tees.male[0].course_rating).toBeNull();
    expect(parsed.course.tees.male[0].slope_rating).toBeNull();
    expect(parsed.course.tees.male[0].holes[0]).toEqual({ par: 4, yardage: 484, handicap: 9 });
  });

  it("defaults a hole's missing yardage/handicap to null, not 0", () => {
    const parsed = golfCourseApiCourseDetailResponseSchema.parse({
      course: {
        id: "7k2m9qb4",
        club_name: "Club",
        course_name: "Club",
        tees: {
          male: [
            {
              tee_name: "White",
              holes: [{ par: 4 }],
            },
          ],
          female: [],
        },
      },
    });
    const hole = parsed.course.tees.male[0].holes[0];
    expect(hole.par).toBe(4);
    expect(hole.yardage).toBeNull();
    expect(hole.handicap).toBeNull();
  });

  it("rejects a response missing the course id", () => {
    expect(() =>
      golfCourseApiCourseDetailResponseSchema.parse({
        course: { club_name: "Club", course_name: "Club", tees: { male: [], female: [] } },
      }),
    ).toThrow();
  });
});
