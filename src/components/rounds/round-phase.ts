import type { Database } from "@/lib/supabase/database.types";

export type RoundStatus = Database["public"]["Enums"]["round_status"];
export type RoundPhase = "setup" | "play" | "finish";

/**
 * The round lifecycle only ever moves scheduled -> in_progress -> locked
 * in this codebase today ('completed' exists in the DB enum but no
 * action ever sets it) -- this maps that lifecycle onto the redesign's
 * three phases. 'completed' is handled defensively alongside 'locked'
 * so nothing breaks if that transition is wired up later.
 *
 * Deliberately NOT in round-nav.tsx: that file is "use client", and
 * Next.js treats every export of a "use client" module as a client
 * reference -- a Server Component calling phaseForStatus() directly
 * (rather than rendering it as JSX) throws "Attempted to call
 * phaseForStatus() from the server but phaseForStatus is on the
 * client." Keeping this plain function in its own client-directive-free
 * module lets Server Components (the round detail page) call it
 * directly while round-nav.tsx's Client Components still import and use
 * it too.
 */
export function phaseForStatus(status: RoundStatus): RoundPhase {
  if (status === "scheduled") return "setup";
  if (status === "in_progress") return "play";
  return "finish";
}

/**
 * The trip dashboard's Rounds section collapses the DB's 4-value status
 * enum into the 4 states a golfer actually cares about at a glance.
 * 'scheduled' alone doesn't say whether a round is truly ready to play,
 * so it splits on golfer count the same way the setup Review step's own
 * canStart check already does (players.length > 0) -- a round nobody's
 * been added to yet is meaningfully different from one that's fully
 * staffed and just waiting on "Start Round." 'completed' and 'locked'
 * both read as "done" here; there's no 4th UI state for "locked."
 */
export type RoundDashboardState = "not_configured" | "ready" | "in_progress" | "completed";

export interface RoundDashboardAction {
  state: RoundDashboardState;
  statusLabel: string;
  primaryLabel: string;
  badgeVariant: "gold" | "success" | "neutral";
}

const DASHBOARD_ACTION: Record<RoundDashboardState, Omit<RoundDashboardAction, "state">> = {
  not_configured: { statusLabel: "Not configured", primaryLabel: "Set Up Round", badgeVariant: "gold" },
  ready: { statusLabel: "Ready to play", primaryLabel: "Start Scoring", badgeVariant: "gold" },
  in_progress: { statusLabel: "In progress", primaryLabel: "Continue Scoring", badgeVariant: "success" },
  completed: { statusLabel: "Completed", primaryLabel: "View Results", badgeVariant: "neutral" },
};

export function dashboardActionForRound(status: RoundStatus, golferCount: number): RoundDashboardAction {
  const state: RoundDashboardState =
    status === "scheduled"
      ? golferCount > 0
        ? "ready"
        : "not_configured"
      : status === "in_progress"
        ? "in_progress"
        : "completed";
  return { state, ...DASHBOARD_ACTION[state] };
}

/**
 * Where a round card's one primary button sends you -- straight into
 * the exact step each state is waiting on, not just the round's own
 * hub page, so "Set Up Round" / "Start Scoring" / etc. always land
 * somewhere that visibly moves the round forward.
 */
export function primaryHrefForRound(tripId: string, roundId: string, state: RoundDashboardState): string {
  const base = `/trips/${tripId}/rounds/${roundId}`;
  switch (state) {
    case "not_configured":
      return base;
    case "ready":
      return `${base}/setup/review`;
    case "in_progress":
      return `${base}/score`;
    case "completed":
      return `${base}/results`;
  }
}

/** Same round, but wherever its Games step currently lives -- setup's Games step before play starts, the persistent Games tab after. */
export function gamesHrefForRound(tripId: string, roundId: string, state: RoundDashboardState): string {
  const base = `/trips/${tripId}/rounds/${roundId}`;
  return state === "not_configured" || state === "ready" ? `${base}/setup/games` : `${base}/games`;
}
