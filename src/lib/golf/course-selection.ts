/**
 * Pure merge logic for the Fast Round Start wizard's course picker
 * (spec item 2): the "recently played" quick-pick list plus, once the
 * golfer searches and picks something, the course they found -- as
 * one deduplicated list a radio group can render, in a stable order
 * (recents first, search result appended only if it isn't already one
 * of the recents). Kept separate from the wizard component so this
 * exact rule -- what shows up, in what order, with no duplicate rows
 * -- is unit-testable without any React/DOM test setup, which this
 * project doesn't otherwise have (vitest here runs in a plain Node
 * environment against src/**\/*.test.ts only).
 */

export interface WizardCourseChoice {
  id: string;
  name: string;
  holeCount: number;
  teeSetNames: string[];
}

export function mergeCourseChoices(
  recentCourses: WizardCourseChoice[],
  searchedCourse: WizardCourseChoice | null,
): WizardCourseChoice[] {
  if (!searchedCourse) {
    return recentCourses;
  }
  if (recentCourses.some((c) => c.id === searchedCourse.id)) {
    return recentCourses;
  }
  return [...recentCourses, searchedCourse];
}
