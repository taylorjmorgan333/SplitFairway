import { describe, expect, it } from "vitest";
import { mergeCourseChoices, type WizardCourseChoice } from "./course-selection";

const RECENT_A: WizardCourseChoice = { id: "a", name: "Pinehurst No. 2", holeCount: 18, teeSetNames: ["Blue", "White"] };
const RECENT_B: WizardCourseChoice = { id: "b", name: "Bethpage Black", holeCount: 18, teeSetNames: ["Black"] };

describe("mergeCourseChoices", () => {
  it("returns just the recent courses when nothing has been searched yet", () => {
    expect(mergeCourseChoices([RECENT_A, RECENT_B], null)).toEqual([RECENT_A, RECENT_B]);
  });

  it("returns an empty list unchanged when there are no recent courses and no search result", () => {
    expect(mergeCourseChoices([], null)).toEqual([]);
  });

  it("appends a freshly searched course after the recent ones", () => {
    const searched: WizardCourseChoice = { id: "c", name: "Augusta National", holeCount: 18, teeSetNames: ["Members"] };
    expect(mergeCourseChoices([RECENT_A, RECENT_B], searched)).toEqual([RECENT_A, RECENT_B, searched]);
  });

  it("lets a search result stand alone when the group has no recent courses at all", () => {
    const searched: WizardCourseChoice = { id: "c", name: "Augusta National", holeCount: 18, teeSetNames: ["Members"] };
    expect(mergeCourseChoices([], searched)).toEqual([searched]);
  });

  it("never duplicates a searched course that matches an existing recent course by id", () => {
    const sameAsRecentA: WizardCourseChoice = { ...RECENT_A, name: "Pinehurst No. 2 (refetched)" };
    expect(mergeCourseChoices([RECENT_A, RECENT_B], sameAsRecentA)).toEqual([RECENT_A, RECENT_B]);
  });
});
