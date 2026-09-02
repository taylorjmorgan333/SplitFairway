/**
 * Lightweight, per-browser onboarding progress helpers.
 *
 * This never stores anything about the trip itself — only whether THIS
 * browser has dismissed the checklist, or clicked through an action that
 * has no other server-side signal (e.g. "I looked at the balances").
 * Losing this state (private browsing, a cleared profile, a different
 * device) just means the checklist reappears — never a functional
 * problem, and never a reason to fabricate trip data to back it up.
 */

const DISMISS_PREFIX = "gtt:onboarding:dismissed:";
const STEP_PREFIX = "gtt:onboarding:step:";

function safeGet(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    // Storage can throw (private browsing, disabled storage) — the
    // checklist just falls back to "not dismissed / not clicked yet".
    return null;
  }
}

function safeSet(key: string, value: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Soft failure — nothing to recover, nothing to show the user.
  }
}

export function isChecklistDismissed(tripId: string): boolean {
  return safeGet(`${DISMISS_PREFIX}${tripId}`) === "1";
}

export function dismissChecklist(tripId: string) {
  safeSet(`${DISMISS_PREFIX}${tripId}`, "1");
}

export type LocalOnboardingStep = "reviewedBalances";

export function markStepDone(tripId: string, step: LocalOnboardingStep) {
  safeSet(`${STEP_PREFIX}${tripId}:${step}`, "1");
}

export function isStepDoneLocally(tripId: string, step: LocalOnboardingStep): boolean {
  return safeGet(`${STEP_PREFIX}${tripId}:${step}`) === "1";
}
