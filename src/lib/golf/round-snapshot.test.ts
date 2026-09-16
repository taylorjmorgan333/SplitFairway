import { describe, expect, it } from "vitest";
import { mergeMissingTeeRatings, type RefreshableTeeSet } from "./round-snapshot";

describe("mergeMissingTeeRatings", () => {
  it("fills in rating and slope on a tee that's missing both", () => {
    const existing: RefreshableTeeSet[] = [
      { name: "Black", course_rating: null, slope_rating: null, total_yards: null },
    ];
    const fresh: RefreshableTeeSet[] = [
      { name: "Black", course_rating: 74.2, slope_rating: 141, total_yards: 7127 },
    ];
    const { merged, updatedTeeNames } = mergeMissingTeeRatings(existing, fresh);
    expect(updatedTeeNames).toEqual(["Black"]);
    expect(merged[0]).toMatchObject({ course_rating: 74.2, slope_rating: 141, total_yards: 7127 });
  });

  it("fills in only the missing half when a tee already has one of the two", () => {
    const existing: RefreshableTeeSet[] = [
      { name: "Gold", course_rating: 71.9, slope_rating: null },
    ];
    const fresh: RefreshableTeeSet[] = [{ name: "Gold", course_rating: 72.5, slope_rating: 128 }];
    const { merged, updatedTeeNames } = mergeMissingTeeRatings(existing, fresh);
    expect(updatedTeeNames).toEqual(["Gold"]);
    // The rating this round already had is preserved even though the
    // fresh course-library value now disagrees -- only the missing
    // slope gets filled in.
    expect(merged[0].course_rating).toBe(71.9);
    expect(merged[0].slope_rating).toBe(128);
  });

  it("never touches a tee that already has both values", () => {
    const existing: RefreshableTeeSet[] = [
      { name: "White", course_rating: 70.1, slope_rating: 125 },
    ];
    const fresh: RefreshableTeeSet[] = [{ name: "White", course_rating: 99.9, slope_rating: 199 }];
    const { merged, updatedTeeNames } = mergeMissingTeeRatings(existing, fresh);
    expect(updatedTeeNames).toEqual([]);
    expect(merged[0]).toBe(existing[0]);
  });

  it("leaves a missing tee alone when the course library doesn't have it either", () => {
    const existing: RefreshableTeeSet[] = [
      { name: "Red", course_rating: null, slope_rating: null },
    ];
    const fresh: RefreshableTeeSet[] = [{ name: "Red", course_rating: null, slope_rating: null }];
    const { merged, updatedTeeNames } = mergeMissingTeeRatings(existing, fresh);
    expect(updatedTeeNames).toEqual([]);
    expect(merged[0].course_rating).toBeNull();
    expect(merged[0].slope_rating).toBeNull();
  });

  it("leaves a tee alone when it has no same-named match in the fresh data", () => {
    const existing: RefreshableTeeSet[] = [
      { name: "Renamed Tee", course_rating: null, slope_rating: null },
    ];
    const fresh: RefreshableTeeSet[] = [{ name: "Different Name", course_rating: 72, slope_rating: 130 }];
    const { merged, updatedTeeNames } = mergeMissingTeeRatings(existing, fresh);
    expect(updatedTeeNames).toEqual([]);
    expect(merged[0].course_rating).toBeNull();
  });

  it("handles several tees, only reporting the ones actually changed", () => {
    const existing: RefreshableTeeSet[] = [
      { name: "Black", course_rating: null, slope_rating: null },
      { name: "White", course_rating: 70.1, slope_rating: 125 },
      { name: "Red (Women's)", course_rating: null, slope_rating: null },
    ];
    const fresh: RefreshableTeeSet[] = [
      { name: "Black", course_rating: 74.2, slope_rating: 141 },
      { name: "White", course_rating: 70.1, slope_rating: 125 },
      { name: "Red (Women's)", course_rating: 69.8, slope_rating: 119 },
    ];
    const { updatedTeeNames } = mergeMissingTeeRatings(existing, fresh);
    expect(updatedTeeNames.sort()).toEqual(["Black", "Red (Women's)"]);
  });
});
