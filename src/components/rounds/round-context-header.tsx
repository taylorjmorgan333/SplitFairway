import { formatDate } from "@/lib/utils";

/**
 * A compact "which round am I looking at" strip shown above the
 * Scorecard/Games/Leaderboard nav on every play-phase screen. Golfers
 * can have several rounds across a trip (or across trips), and none of
 * those screens previously repeated the course or date anywhere near
 * the nav -- only the round hub page (behind the "⋯" menu) said so.
 * Deliberately just two lines of text, no card chrome, so it doesn't
 * compete with the nav directly below it.
 */
export function RoundContextHeader({
  roundName,
  courseName,
  courseLocation,
  roundDate,
}: {
  roundName: string | null;
  courseName: string;
  courseLocation: string | null;
  roundDate: string;
}) {
  const title = roundName || courseName;
  const subtitleParts = [roundName ? courseName : null, courseLocation, formatDate(roundDate)].filter(
    (part): part is string => Boolean(part),
  );

  return (
    <div className="mb-3">
      <p className="truncate font-serif text-lg text-forest-900">{title}</p>
      {subtitleParts.length > 0 && <p className="text-sm text-charcoal-500">{subtitleParts.join(" · ")}</p>}
    </div>
  );
}
