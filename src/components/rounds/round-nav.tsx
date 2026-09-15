"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { MoreVertical } from "lucide-react";
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
 * while a round is being played it shows only the screens that matter
 * mid-round -- Scorecard, Games, 19th Hole -- once it's finished it
 * swaps to the two post-round screens (Results, Settle Up). Leaderboard
 * is no longer its own tab: the Scorecard screen now shows live
 * standings alongside score entry itself (desktop: side by side;
 * mobile: below score entry), so a separate tab for the same
 * information just added a click. Its standalone route still exists
 * for a direct link, it's just not promoted in this nav.
 *
 * "Round Details" moved off this row and into a three-dot "Round
 * options" menu at the end of it -- it was competing for space with the
 * tab pills and, being plain text, read as a fourth tab rather than the
 * secondary/settings action it actually is.
 */
export function RoundPhaseTabs({
  tripId,
  roundId,
  status,
  sideGamesEnabled,
  nineteenthHoleEnabled = false,
  scoresComplete = false,
}: {
  tripId: string;
  roundId: string;
  status: RoundStatus;
  sideGamesEnabled: boolean;
  /** Shows "19th Hole" alongside Scorecard/Games -- the app-wide rollout
   * flag, not the trip's own on/off switch, so the tab exists and links
   * into the feature's own enable screen even before a captain has
   * turned it on for this trip. */
  nineteenthHoleEnabled?: boolean;
  /** True once every golfer has a score posted for every hole -- swaps the "Round in progress" caption for "Scores Complete" instead of leaving it stuck mid-round after the last putt drops. */
  scoresComplete?: boolean;
}) {
  const pathname = usePathname();
  const base = `/trips/${tripId}/rounds/${roundId}`;
  const phase = phaseForStatus(status);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onDocPointer(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDocPointer);
    return () => document.removeEventListener("mousedown", onDocPointer);
  }, [menuOpen]);

  const playTabs: PlayFinishTab[] = [
    { key: "score", label: "Scorecard", href: `${base}/score`, show: true },
    { key: "games", label: "Games", href: `${base}/games`, show: sideGamesEnabled },
    { key: "nineteenth-hole", label: "19th Hole", href: `${base}/nineteenth-hole`, show: nineteenthHoleEnabled },
  ];
  const finishTabs: PlayFinishTab[] = [
    { key: "results", label: "Results", href: `${base}/results`, show: true },
    { key: "settle", label: "Settle Up", href: `${base}/settle`, show: true },
  ];
  const tabs = (phase === "finish" ? finishTabs : playTabs).filter((t) => t.show);

  return (
    <nav aria-label="Round" className="mb-5">
      {/* -mx-5 px-5 lets this bleed to the screen edge and scroll
          horizontally if it's ever too tight for both the tab pill and
          the "Round Details" label to fit side by side, instead of
          wrapping or clipping either one. */}
      <div className="-mx-5 overflow-x-auto px-5 sm:mx-0 sm:px-0">
        <div className="flex w-fit min-w-full items-center justify-between gap-2">
          <div className="flex flex-1 gap-1 rounded-full bg-cream-100 p-1">
            {tabs.map((tab) => {
              const active = pathname === tab.href || pathname?.startsWith(`${tab.href}/`);
              return (
                <Link
                  key={tab.key}
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex-1 whitespace-nowrap rounded-full px-2 py-2.5 text-center text-base font-medium transition-colors",
                    active ? "bg-white text-forest-900 shadow-sm" : "text-charcoal-500 hover:text-forest-800",
                  )}
                >
                  {tab.label}
                </Link>
              );
            })}
          </div>
          <div className="relative shrink-0" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label="Round options"
              className="flex h-11 w-11 items-center justify-center rounded-full text-charcoal-500 transition-colors hover:bg-cream-100 hover:text-forest-800"
            >
              <MoreVertical className="h-5 w-5" aria-hidden="true" />
            </button>
            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 z-20 mt-1 w-52 overflow-hidden rounded-lg border border-forest-900/10 bg-white shadow-lg"
              >
                <Link
                  href={base}
                  role="menuitem"
                  onClick={() => setMenuOpen(false)}
                  className="block min-h-11 w-full px-4 py-2.5 text-left text-base leading-[2.75rem] text-forest-900 hover:bg-cream-100"
                >
                  Round Details
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
      <p className="mt-2 text-sm text-charcoal-400">
        {phase === "play" ? (scoresComplete ? "Scores Complete" : "Round in progress") : "Round finished"}
      </p>
    </nav>
  );
}
