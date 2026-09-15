/**
 * Pure merge logic for the Quick Round setup screen's unified course
 * picker (spec addendum: "Saved Courses: show favorited/saved courses
 * first; show recently played courses underneath"). Kept separate from
 * any component, same reasoning as course-selection.ts's own doc
 * comment -- this exact ordering/dedup rule is unit-testable without
 * any React/DOM test setup, which this project doesn't otherwise have.
 */

export interface QuickRoundCourseChoice {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  holeCount: number;
  teeSetNames: string[];
  favorited: boolean;
  /** ISO date (YYYY-MM-DD) this golfer last played this course, or null if it's saved but never played. */
  lastPlayedDate: string | null;
}

/**
 * Saved courses first (in the order given -- newest-favorited first is
 * the caller's job when querying), then recently-played courses
 * underneath, with any course that's both saved and recently played
 * appearing once, in the saved list, never twice.
 */
export function mergeQuickRoundCourseChoices(
  favorites: QuickRoundCourseChoice[],
  recents: QuickRoundCourseChoice[],
): QuickRoundCourseChoice[] {
  const favoriteIds = new Set(favorites.map((c) => c.id));
  const dedupedRecents = recents.filter((c) => !favoriteIds.has(c.id));
  return [...favorites, ...dedupedRecents];
}

/**
 * The one-tap "quick pick" row on the main Quick Round screen (spec:
 * "selecting a recent course should require one tap") -- just the front
 * of the merged list, capped so the main screen never has to scroll to
 * find "Search All Courses" underneath it.
 */
export function quickPickCourses(
  merged: QuickRoundCourseChoice[],
  limit = 4,
): QuickRoundCourseChoice[] {
  return merged.slice(0, limit);
}
