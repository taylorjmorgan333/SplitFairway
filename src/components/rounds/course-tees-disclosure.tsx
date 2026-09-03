"use client";

import type { SnapshotTeeSet } from "@/components/rounds/mobile-scorecard";

/**
 * Replaces the old always-visible "Tees: White, Gold, Gold — copied
 * from the course library..." paragraph, which (a) read as a wall of
 * text unrelated to any single decision on the page and (b) showed
 * duplicate-looking tee names with no way to tell them apart when a
 * course has e.g. two tees both named "Gold" for men and women. This
 * is opt-in (a <details> disclosure) and, when a tee set's category is
 * known and more than one tee shares a name, appends "— Men"/"— Women"
 * so they're distinguishable; otherwise it shows the tee name alone.
 */
export function CourseTeesDisclosure({ teeSets }: { teeSets: SnapshotTeeSet[] }) {
  if (teeSets.length === 0) return null;

  const nameCounts = new Map<string, number>();
  for (const t of teeSets) {
    nameCounts.set(t.name, (nameCounts.get(t.name) ?? 0) + 1);
  }

  function categoryLabel(category: SnapshotTeeSet["category"]): string | null {
    if (category === "male") return "Men";
    if (category === "female") return "Women";
    if (category === "unisex") return null;
    return null;
  }

  function labelFor(t: SnapshotTeeSet): string {
    const dup = (nameCounts.get(t.name) ?? 0) > 1;
    const catLabel = dup ? categoryLabel(t.category) : null;
    return catLabel ? `${t.name} — ${catLabel}` : t.name;
  }

  return (
    <details className="mt-3 rounded-lg border border-charcoal-400/15 bg-white/60 open:bg-white">
      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-forest-800 [&::-webkit-details-marker]:hidden">
        View course tees
      </summary>
      <div className="-mx-4 overflow-x-auto px-4 pb-4">
        <table className="w-full min-w-max text-left text-sm">
          <thead>
            <tr className="border-b border-charcoal-400/15 text-xs uppercase tracking-wide text-charcoal-400">
              <th className="py-2 pr-4 font-medium">Tee</th>
              <th className="py-2 pr-4 font-medium">Yardage</th>
              <th className="py-2 pr-4 font-medium">Par</th>
              <th className="py-2 pr-4 font-medium">Rating</th>
              <th className="py-2 font-medium">Slope</th>
            </tr>
          </thead>
          <tbody>
            {teeSets.map((t) => {
              const par = t.holes.reduce((sum, h) => sum + (h.par ?? 0), 0);
              const yards = t.total_yards ?? t.holes.reduce((sum, h) => sum + (h.yardage ?? 0), 0);
              return (
                <tr key={t.name} className="border-b border-charcoal-400/10 last:border-b-0">
                  <td className="py-2 pr-4 font-medium text-charcoal-800">{labelFor(t)}</td>
                  <td className="py-2 pr-4 text-charcoal-600">{yards || "—"}</td>
                  <td className="py-2 pr-4 text-charcoal-600">{par || "—"}</td>
                  <td className="py-2 pr-4 text-charcoal-600">{t.course_rating ?? "—"}</td>
                  <td className="py-2 text-charcoal-600">{t.slope_rating ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="px-4 pb-4 text-xs text-charcoal-400">
        Copied from the course library when this round was created — later course edits won&apos;t
        change this round.
      </p>
    </details>
  );
}
