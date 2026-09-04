"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { phaseForStatus, type RoundStatus } from "@/components/rounds/round-phase";

// phaseForStatus/RoundPhase live in ./round-phase (no "use client"),
// deliberately NOT re-exported from here: this file has "use client",
// and Next.js treats every export of a "use client" module as a client
// reference. A Server Component (the round detail page) must import
// phaseForStatus from "@/components/rounds/round-phase" directly, or it
// throws "Attempted to call phaseForStatus() from the server but
// phaseForStatus is on the client."

const SETUP_STEPS = ["Course", "Players", "Games", "Review"] as const;

/**
 * Step indicator shown at the top of every screen in the 4-step setup
 * flow. Earlier, already-visited steps are clickable so a captain can
 * go back and change something without losing later work (round/player/
 * group rows are saved to the database as soon as each step's action
 * runs, not held in unsaved client state) -- steps ahead of the current
 * one aren't shown as links since nothing later has been reached yet.
 */
export function SetupStepNav({
  tripId,
  roundId,
  currentStep,
}: {
  tripId: string;
  roundId: string | null;
  currentStep: 1 | 2 | 3 | 4;
}) {
  const stepHrefs: (string | null)[] = [
    `/trips/${tripId}/rounds/new`,
    roundId ? `/trips/${tripId}/rounds/${roundId}` : null,
    roundId ? `/trips/${tripId}/rounds/${roundId}/setup/games` : null,
    roundId ? `/trips/${tripId}/rounds/${roundId}/setup/review` : null,
  ];

  return (
    <nav aria-label="Round setup progress" className="mb-5">
      <p className="text-base font-semibold text-charcoal-600">
        Step {currentStep} of 4 — {SETUP_STEPS[currentStep - 1]}
      </p>
      <ol className="mt-2 flex items-center gap-1.5">
        {SETUP_STEPS.map((label, i) => {
          const stepNum = (i + 1) as 1 | 2 | 3 | 4;
          const done = stepNum < currentStep;
          const active = stepNum === currentStep;
          const href = stepHrefs[i];
          const bar = (
            <span
              aria-hidden="true"
              className={cn(
                "block h-1.5 flex-1 rounded-full transition-colors",
                done && "bg-forest-700",
                active && "bg-forest-500",
                !done && !active && "bg-charcoal-400/20",
              )}
            />
          );
          return (
            <li key={label} className="flex-1">
              {done && href ? (
                <Link href={href} className="block" aria-label={`Back to ${label}`}>
                  {bar}
                </Link>
              ) : (
                bar
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

interface PlayFinishTab {
  key: string;
  label: string;
  href: string;
  show: boolean;
}

/**
 * The persistent nav for a round that's in play or finished, replacing
 * the old flat row of buttons that lived only on the round-detail page
 * (and so vanished the moment a golfer navigated to Enter Scores,
 * Games, etc.). Rendered at the top of every route so it's always
 * visible and always shows where you are.
 *
 * The tab SET itself is phase-aware, not just which ones are enabled:
 * while a round is being played it shows only the three screens that
 * matter mid-round (Scorecard, Games, Leaderboard); once it's finished
 * it swaps to the two post-round screens (Results, Settle Up). This
 * keeps the nav to 2-3 items at a time instead of piling every screen
 * into one row regardless of what's actually usable right now.
 */
export function RoundPhaseTabs({
  tripId,
  roundId,
  status,
  sideGamesEnabled,
  leaderboardEnabled,
}: {
  tripId: string;
  roundId: string;
  status: RoundStatus;
  sideGamesEnabled: boolean;
  leaderboardEnabled: boolean;
}) {
  const pathname = usePathname();
  const base = `/trips/${tripId}/rounds/${roundId}`;
  const phase = phaseForStatus(status);

  const playTabs: PlayFinishTab[] = [
    { key: "score", label: "Scorecard", href: `${base}/score`, show: true },
    { key: "games", label: "Games", href: `${base}/games`, show: sideGamesEnabled },
    { key: "leaderboard", label: "Leaderboard", href: `${base}/leaderboard`, show: leaderboardEnabled },
  ];
  const finishTabs: PlayFinishTab[] = [
    { key: "results", label: "Results", href: `${base}/results`, show: true },
    { key: "settle", label: "Settle Up", href: `${base}/settle`, show: true },
  ];
  const tabs = (phase === "finish" ? finishTabs : playTabs).filter((t) => t.show);

  return (
    <nav aria-label="Round" className="mb-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-1 gap-1 rounded-full bg-cream-100 p-1">
          {tabs.map((tab) => {
            const active = pathname === tab.href || pathname?.startsWith(`${tab.href}/`);
            return (
              <Link
                key={tab.key}
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex-1 rounded-full px-2 py-2.5 text-center text-base font-medium transition-colors",
                  active ? "bg-white text-forest-900 shadow-sm" : "text-charcoal-500 hover:text-forest-800",
                )}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
        <Link
          href={base}
          aria-label="Round details, players and groups"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-charcoal-500 hover:bg-cream-100 hover:text-forest-800"
        >
          <span aria-hidden="true" className="text-lg leading-none">
            ⋯
          </span>
        </Link>
      </div>
      <p className="mt-2 text-sm text-charcoal-400">
        {phase === "play" ? "Round in progress" : "Round finished"} · Tap ⋯ for round details, players
        and groups.
      </p>
    </nav>
  );
}
