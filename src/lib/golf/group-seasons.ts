/**
 * Season resolution for Group standings. Pure date math, no DB -- a
 * round "belongs" to a season purely by its round_date falling between
 * start_date/end_date, computed here at read time (see the comment on
 * golf_group_seasons in supabase/migrations/20260916100000_group_seasons.sql).
 * Every group has an implicit calendar-year season even before a
 * captain ever creates a custom one, so "this season" always means
 * something.
 */

export interface GroupSeason {
  id: string | null;
  name: string;
  startDate: string;
  endDate: string;
}

/** The implicit default season: the calendar year containing `today`. Its id is null -- it's never a real golf_group_seasons row unless a captain has explicitly created one covering this range. */
export function currentCalendarYearSeason(today: Date = new Date()): GroupSeason {
  const year = today.getUTCFullYear();
  return {
    id: null,
    name: String(year),
    startDate: `${year}-01-01`,
    endDate: `${year}-12-31`,
  };
}

/**
 * Which season is "current" for a group right now: the most recently
 * created custom season whose range covers today, if any, else the
 * implicit calendar-year default. Seasons are allowed to overlap (a
 * captain might make a mistake); "most recently created" is a simple,
 * predictable tiebreaker rather than silently picking one at random.
 */
export function resolveCurrentSeason(
  seasons: { id: string; name: string; start_date: string; end_date: string; created_at: string }[],
  today: Date = new Date(),
): GroupSeason {
  const todayStr = today.toISOString().slice(0, 10);
  const covering = seasons
    .filter((s) => s.start_date <= todayStr && s.end_date >= todayStr)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  if (covering.length > 0) {
    const s = covering[0];
    return { id: s.id, name: s.name, startDate: s.start_date, endDate: s.end_date };
  }
  return currentCalendarYearSeason(today);
}

export function isDateInSeason(dateStr: string, season: GroupSeason): boolean {
  return dateStr >= season.startDate && dateStr <= season.endDate;
}
