import { describe, expect, it } from "vitest";
import { currentCalendarYearSeason, resolveCurrentSeason, isDateInSeason } from "./group-seasons";

describe("currentCalendarYearSeason", () => {
  it("spans the full calendar year of the given date", () => {
    const season = currentCalendarYearSeason(new Date("2026-06-15T00:00:00Z"));
    expect(season).toEqual({ id: null, name: "2026", startDate: "2026-01-01", endDate: "2026-12-31" });
  });
});

describe("resolveCurrentSeason", () => {
  it("falls back to the calendar year when no saved season covers today", () => {
    const season = resolveCurrentSeason([], new Date("2026-06-15T00:00:00Z"));
    expect(season).toEqual({ id: null, name: "2026", startDate: "2026-01-01", endDate: "2026-12-31" });
  });

  it("picks a custom season whose date range covers today over the calendar-year fallback", () => {
    const seasons = [
      {
        id: "s1",
        name: "Summer League",
        start_date: "2026-06-01",
        end_date: "2026-08-31",
        created_at: "2026-01-01T00:00:00Z",
      },
    ];
    const season = resolveCurrentSeason(seasons, new Date("2026-07-04T00:00:00Z"));
    expect(season).toEqual({ id: "s1", name: "Summer League", startDate: "2026-06-01", endDate: "2026-08-31" });
  });

  it("ignores a saved season that doesn't cover today", () => {
    const seasons = [
      {
        id: "s1",
        name: "Winter League",
        start_date: "2025-12-01",
        end_date: "2026-02-28",
        created_at: "2025-01-01T00:00:00Z",
      },
    ];
    const season = resolveCurrentSeason(seasons, new Date("2026-07-04T00:00:00Z"));
    expect(season.id).toBeNull();
    expect(season.name).toBe("2026");
  });

  it("picks the most recently created season when two overlap today", () => {
    const seasons = [
      { id: "older", name: "Older", start_date: "2026-01-01", end_date: "2026-12-31", created_at: "2026-01-01T00:00:00Z" },
      { id: "newer", name: "Newer", start_date: "2026-06-01", end_date: "2026-06-30", created_at: "2026-05-01T00:00:00Z" },
    ];
    const season = resolveCurrentSeason(seasons, new Date("2026-06-15T00:00:00Z"));
    expect(season.id).toBe("newer");
  });
});

describe("isDateInSeason", () => {
  const season = { id: "s1", name: "Summer", startDate: "2026-06-01", endDate: "2026-08-31" };

  it("returns true for a date within range, inclusive of both endpoints", () => {
    expect(isDateInSeason("2026-06-01", season)).toBe(true);
    expect(isDateInSeason("2026-08-31", season)).toBe(true);
    expect(isDateInSeason("2026-07-15", season)).toBe(true);
  });

  it("returns false for a date outside range", () => {
    expect(isDateInSeason("2026-05-31", season)).toBe(false);
    expect(isDateInSeason("2026-09-01", season)).toBe(false);
  });
});
