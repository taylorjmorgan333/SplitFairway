import { formatDate } from "@/lib/utils";

/**
 * A compact "which round am I looking at" strip shown above the
 * Scorecard/Games/19th Hole nav on every play-phase screen. Golfers can
 * have several rounds across a trip (or across trips), and none of
 * those screens previously repeated the course or date anywhere near
 * the nav -- only the round hub page (behind the round options menu)
 * said so.
 *
 * Format is deliberately fixed and simple -- title is always the course
 * name, one details line covers round type, date and hole count
 * ("Quick Round · September 15, 2026 · 18 holes") -- replacing an
 * earlier version whose title swapped between a custom round name and
 * the course name and whose subtitle could repeat the course name
 * again, which read as a duplicated/cluttered heading. A custom round
 * name (rare -- most rounds never get one) still shows, as a small
 * label above the title, rather than silently disappearing.
 */
export function RoundContextHeader({
  roundName,
  roundType,
  courseName,
  roundDate,
  holeCount,
}: {
  roundName: string | null;
  roundType: string;
  courseName: string;
  roundDate: string;
  holeCount: number;
}) {
  return (
    <div className="mb-3">
      {roundName && (
        <p className="truncate text-xs font-medium uppercase tracking-wide text-charcoal-400">{roundName}</p>
      )}
      <p className="truncate font-serif text-lg text-forest-900">{courseName}</p>
      <p className="text-sm text-charcoal-500">
        {roundType} · {formatDate(roundDate)} · {holeCount} {holeCount === 1 ? "hole" : "holes"}
      </p>
    </div>
  );
}
