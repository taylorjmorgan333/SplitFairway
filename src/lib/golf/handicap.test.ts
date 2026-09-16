import { describe, expect, it } from "vitest";
import {
  allocateStrokes,
  netScore,
  roundHandicap,
  calculateCourseHandicap,
  courseHandicapForTee,
  teeSetPar,
  findTeeSetByName,
  type HoleStrokeIndex,
  type HandicapTeeSet,
} from "./handicap";

function holesWithIndexes(indexes: number[]): HoleStrokeIndex[] {
  return indexes.map((strokeIndex, i) => ({ holeNumber: i + 1, strokeIndex }));
}

const EIGHTEEN_HOLE_INDEXES = [7, 13, 1, 15, 3, 17, 11, 5, 9, 8, 14, 2, 16, 4, 18, 12, 6, 10];

describe("allocateStrokes", () => {
  it("gives a 0 playing handicap no strokes on any hole", () => {
    const result = allocateStrokes(0, holesWithIndexes(EIGHTEEN_HOLE_INDEXES));
    for (const strokes of result.values()) {
      expect(strokes).toBe(0);
    }
  });

  it("gives an 8 playing handicap one stroke on stroke-index holes 1-8 only", () => {
    const holes = holesWithIndexes(EIGHTEEN_HOLE_INDEXES);
    const result = allocateStrokes(8, holes);
    for (const h of holes) {
      const expected = (h.strokeIndex ?? Infinity) <= 8 ? 1 : 0;
      expect(result.get(h.holeNumber)).toBe(expected);
    }
  });

  it("gives a 20 playing handicap one stroke everywhere and a second on stroke-index holes 1-2", () => {
    const holes = holesWithIndexes(EIGHTEEN_HOLE_INDEXES);
    const result = allocateStrokes(20, holes);
    for (const h of holes) {
      const expected = (h.strokeIndex ?? Infinity) <= 2 ? 2 : 1;
      expect(result.get(h.holeNumber)).toBe(expected);
    }
  });

  it("handles a plus (negative) handicap by giving strokes back on the hardest holes", () => {
    const holes = holesWithIndexes(EIGHTEEN_HOLE_INDEXES);
    const result = allocateStrokes(-2, holes);
    for (const h of holes) {
      const expected = (h.strokeIndex ?? Infinity) <= 2 ? -1 : 0;
      // allocateStrokes computes sign * strokes, so a hole with 0
      // strokes under a negative handicap comes back as -0 -- adding 0
      // normalizes -0 to +0 (per IEEE 754) before the Object.is-based
      // toBe check, since -0 and 0 are the same playing-handicap
      // outcome (no stroke), not a real distinction worth asserting on.
      expect((result.get(h.holeNumber) ?? NaN) + 0).toBe(expected);
    }
  });

  it("allocates correctly for a nine-hole round using its own stroke indexes", () => {
    // A nine-hole card's stroke indexes are commonly the odd (or even)
    // numbers 1-17/2-18 carried over from the 18-hole card, not 1-9 --
    // allocateStrokes must rank by relative difficulty among the holes
    // actually being played, not assume indexes run 1-9.
    const nineHoles = holesWithIndexes([1, 5, 9, 13, 17, 3, 7, 11, 15]);
    const result = allocateStrokes(5, nineHoles);
    const strokeCounts = [...result.values()];
    expect(strokeCounts.filter((s) => s === 1)).toHaveLength(5);
    expect(strokeCounts.filter((s) => s === 0)).toHaveLength(4);
    // The 5 hardest (lowest stroke index) holes get the stroke.
    for (const h of nineHoles) {
      expect(result.get(h.holeNumber)).toBe((h.strokeIndex ?? Infinity) <= 9 ? 1 : 0);
    }
  });

  it("returns null for holes with no stroke index instead of guessing", () => {
    const holes: HoleStrokeIndex[] = [
      { holeNumber: 1, strokeIndex: 1 },
      { holeNumber: 2, strokeIndex: null },
    ];
    const result = allocateStrokes(10, holes);
    expect(result.get(2)).toBeNull();
  });
});

describe("netScore", () => {
  it("is null when gross or strokes received is unknown", () => {
    expect(netScore(null, 1)).toBeNull();
    expect(netScore(4, null)).toBeNull();
    expect(netScore(4, undefined)).toBeNull();
  });

  it("subtracts strokes received from gross", () => {
    expect(netScore(5, 1)).toBe(4);
    expect(netScore(5, -1)).toBe(6);
    expect(netScore(5, 0)).toBe(5);
  });
});

describe("roundHandicap", () => {
  it("rounds a plain decimal to the nearest whole number", () => {
    expect(roundHandicap(10.4)).toBe(10);
    expect(roundHandicap(10.5)).toBe(11);
    expect(roundHandicap(10.6)).toBe(11);
  });

  it("rounds exactly .5 upward (toward positive infinity) for a negative/plus value", () => {
    expect(roundHandicap(-2.5)).toBe(-2);
    expect(roundHandicap(-2.51)).toBe(-3);
    expect(roundHandicap(-2.49)).toBe(-2);
  });

  it("handles zero", () => {
    expect(roundHandicap(0)).toBe(0);
  });
});

describe("calculateCourseHandicap", () => {
  it("returns the Handicap Index unchanged at a neutral tee (Slope 113, Rating = Par)", () => {
    // Course Handicap = Index x (113/113) + (72 - 72) = Index.
    const result = calculateCourseHandicap({
      handicapIndex: 12.4,
      slopeRating: 113,
      courseRating: 72,
      par: 72,
    });
    expect(result).toBe(12);
  });

  it("increases the Course Handicap for a tee with a higher Slope", () => {
    // 12.4 x (140/113) + 0 = 15.36... -> 15
    const result = calculateCourseHandicap({
      handicapIndex: 12.4,
      slopeRating: 140,
      courseRating: 72,
      par: 72,
    });
    expect(result).toBe(15);
  });

  it("increases the Course Handicap when Rating is higher than Par", () => {
    // 10 x (113/113) + (74.2 - 72) = 12.2 -> 12
    const result = calculateCourseHandicap({
      handicapIndex: 10,
      slopeRating: 113,
      courseRating: 74.2,
      par: 72,
    });
    expect(result).toBe(12);
  });

  it("decreases the Course Handicap when Rating is lower than Par", () => {
    // 10 x (113/113) + (69.5 - 72) = 7.5 -> 8 (0.5 rounds upward)
    const result = calculateCourseHandicap({
      handicapIndex: 10,
      slopeRating: 113,
      courseRating: 69.5,
      par: 72,
    });
    expect(result).toBe(8);
  });

  it("handles a zero Handicap Index", () => {
    // 0 x (135/113) + (73.1 - 71) = 2.1 -> 2
    const result = calculateCourseHandicap({
      handicapIndex: 0,
      slopeRating: 135,
      courseRating: 73.1,
      par: 71,
    });
    expect(result).toBe(2);
  });

  it("handles a plus/negative Handicap Index", () => {
    // -2.5 x (125/113) + (71.8 - 72) = -2.966... -> -3
    const result = calculateCourseHandicap({
      handicapIndex: -2.5,
      slopeRating: 125,
      courseRating: 71.8,
      par: 72,
    });
    expect(result).toBe(-3);
  });

  it("handles a decimal Handicap Index precisely before rounding only the final result", () => {
    // 8.4 x (141/113) + (74.2 - 72) = 10.484... + 2.2 = 12.684... -> 13
    const result = calculateCourseHandicap({
      handicapIndex: 8.4,
      slopeRating: 141,
      courseRating: 74.2,
      par: 72,
    });
    expect(result).toBe(13);
  });

  it("matches the exact worked example from the round-setup UI spec (Black tee, 74.2/141, index 8.4 -> Course Handicap 13)", () => {
    const result = calculateCourseHandicap({
      handicapIndex: 8.4,
      slopeRating: 141,
      courseRating: 74.2,
      par: 72,
    });
    expect(result).toBe(13);
  });

  it("supports valid nine-hole Rating/Slope/Par data the same way as 18-hole data", () => {
    // A real nine-hole tee's own Rating/Slope, not half of an 18-hole
    // value: 9 x (122/113) + (35.9 - 36) = 9.7...  -1 = wait computed below
    const result = calculateCourseHandicap({
      handicapIndex: 9,
      slopeRating: 122,
      courseRating: 35.9,
      par: 36,
    });
    // 9 x (122/113) = 9.7168...; + (35.9-36) = -0.1 => 9.6168 -> 10
    expect(result).toBe(10);
  });

  it("returns null -- never a fabricated number -- when Slope is missing", () => {
    expect(
      calculateCourseHandicap({ handicapIndex: 10, slopeRating: null, courseRating: 72, par: 72 }),
    ).toBeNull();
  });

  it("returns null when Rating is missing", () => {
    expect(
      calculateCourseHandicap({ handicapIndex: 10, slopeRating: 113, courseRating: null, par: 72 }),
    ).toBeNull();
  });

  it("returns null when the Handicap Index itself is missing", () => {
    expect(
      calculateCourseHandicap({ handicapIndex: null, slopeRating: 113, courseRating: 72, par: 72 }),
    ).toBeNull();
  });

  it("returns null when Par is missing (never assumes Rating equals Par)", () => {
    expect(
      calculateCourseHandicap({ handicapIndex: 10, slopeRating: 113, courseRating: 72, par: null }),
    ).toBeNull();
  });

  it("never substitutes the neutral Slope of 113 for a missing Slope", () => {
    const withMissingSlope = calculateCourseHandicap({
      handicapIndex: 10,
      slopeRating: null,
      courseRating: 74,
      par: 72,
    });
    const withNeutralSlope = calculateCourseHandicap({
      handicapIndex: 10,
      slopeRating: 113,
      courseRating: 74,
      par: 72,
    });
    expect(withMissingSlope).toBeNull();
    expect(withNeutralSlope).not.toBeNull();
  });

  it("is exact at the .5 rounding boundary in both directions", () => {
    // Index chosen so raw value lands exactly on x.5.
    expect(
      calculateCourseHandicap({ handicapIndex: 10, slopeRating: 113, courseRating: 72.5, par: 72 }),
    ).toBe(11); // 10 + 0.5 = 10.5 -> 11
    expect(
      calculateCourseHandicap({ handicapIndex: 10, slopeRating: 113, courseRating: 71.5, par: 72 }),
    ).toBe(10); // 10 - 0.5 = 9.5 -> 10
  });
});

describe("teeSetPar", () => {
  it("sums hole pars", () => {
    const tee: HandicapTeeSet = { name: "Black", holes: [{ par: 4 }, { par: 4 }, { par: 3 }] };
    expect(teeSetPar(tee)).toBe(11);
  });

  it("returns null when there is no hole data, rather than 0", () => {
    expect(teeSetPar({ name: "Black", holes: [] })).toBeNull();
    expect(teeSetPar({ name: "Black" })).toBeNull();
    expect(teeSetPar(null)).toBeNull();
  });
});

describe("findTeeSetByName", () => {
  const teeSets: HandicapTeeSet[] = [
    { name: "Black", course_rating: 74.2, slope_rating: 141 },
    { name: "White (Men's)", course_rating: 71.0, slope_rating: 128 },
    { name: "White (Women's)", course_rating: 73.5, slope_rating: 132 },
  ];

  it("finds an exact name match", () => {
    expect(findTeeSetByName(teeSets, "Black")?.slope_rating).toBe(141);
  });

  it("keeps men's and women's tees of the same color distinct", () => {
    expect(findTeeSetByName(teeSets, "White (Men's)")?.course_rating).toBe(71.0);
    expect(findTeeSetByName(teeSets, "White (Women's)")?.course_rating).toBe(73.5);
  });

  it("returns null for no name or no match", () => {
    expect(findTeeSetByName(teeSets, null)).toBeNull();
    expect(findTeeSetByName(teeSets, undefined)).toBeNull();
    expect(findTeeSetByName(teeSets, "Gold")).toBeNull();
  });
});

describe("courseHandicapForTee", () => {
  const black: HandicapTeeSet = {
    name: "Black",
    course_rating: 74.2,
    slope_rating: 141,
    holes: Array.from({ length: 18 }, () => ({ par: 4 })), // par 72
  };

  it("computes the Course Handicap for a fully-specified tee", () => {
    expect(courseHandicapForTee(8.4, black)).toBe(13);
  });

  it("returns null when no tee is selected", () => {
    expect(courseHandicapForTee(8.4, null)).toBeNull();
    expect(courseHandicapForTee(8.4, undefined)).toBeNull();
  });

  it("returns null when the tee is missing Rating or Slope, never silently using the Handicap Index as-is", () => {
    const missingSlope: HandicapTeeSet = { name: "Pradera Black", course_rating: 74.2, holes: black.holes };
    expect(courseHandicapForTee(8.4, missingSlope)).toBeNull();
  });
});
