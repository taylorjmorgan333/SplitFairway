import { describe, expect, it } from "vitest";
import { mergeQuickRoundCourseChoices, quickPickCourses, type QuickRoundCourseChoice } from "./quick-round-course-list";

function course(overrides: Partial<QuickRoundCourseChoice> & { id: string; name: string }): QuickRoundCourseChoice {
  return {
    city: null,
    state: null,
    holeCount: 18,
    teeSetNames: [],
    favorited: false,
    lastPlayedDate: null,
    ...overrides,
  };
}

const SAVED_A = course({ id: "a", name: "Pinehurst No. 2", favorited: true });
const SAVED_B = course({ id: "b", name: "Bethpage Black", favorited: true });
const RECENT_C = course({ id: "c", name: "Augusta National", lastPlayedDate: "2026-05-01" });
const RECENT_D = course({ id: "d", name: "Torrey Pines", lastPlayedDate: "2026-04-01" });

describe("mergeQuickRoundCourseChoices", () => {
  it("puts saved courses first, recently played courses underneath", () => {
    expect(mergeQuickRoundCourseChoices([SAVED_A, SAVED_B], [RECENT_C, RECENT_D])).toEqual([
      SAVED_A,
      SAVED_B,
      RECENT_C,
      RECENT_D,
    ]);
  });

  it("returns an empty list when there are no saved or recent courses", () => {
    expect(mergeQuickRoundCourseChoices([], [])).toEqual([]);
  });

  it("shows a saved course only once even if it also appears in recents", () => {
    const alsoRecent = { ...SAVED_A, lastPlayedDate: "2026-06-01" };
    expect(mergeQuickRoundCourseChoices([SAVED_A], [alsoRecent, RECENT_C])).toEqual([SAVED_A, RECENT_C]);
  });

  it("works with only recents and no saved courses", () => {
    expect(mergeQuickRoundCourseChoices([], [RECENT_C, RECENT_D])).toEqual([RECENT_C, RECENT_D]);
  });
});

describe("quickPickCourses", () => {
  it("caps the one-tap quick-pick list at the given limit", () => {
    const merged = [SAVED_A, SAVED_B, RECENT_C, RECENT_D];
    expect(quickPickCourses(merged, 2)).toEqual([SAVED_A, SAVED_B]);
  });

  it("defaults to a limit of 4", () => {
    const fifth = course({ id: "e", name: "Whistling Straits" });
    const merged = [SAVED_A, SAVED_B, RECENT_C, RECENT_D, fifth];
    expect(quickPickCourses(merged)).toEqual([SAVED_A, SAVED_B, RECENT_C, RECENT_D]);
  });

  it("returns everything unchanged when there are fewer courses than the limit", () => {
    expect(quickPickCourses([SAVED_A], 4)).toEqual([SAVED_A]);
  });

  it("returns an empty list unchanged", () => {
    expect(quickPickCourses([], 4)).toEqual([]);
  });
});
