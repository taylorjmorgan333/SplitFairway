"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { discardRoundAction, restoreRoundAction } from "@/actions/rounds";
import { RoundOptionsMenu } from "@/components/rounds/round-options-menu";

// How long the "Round discarded — Undo" toast stays up before the undo
// window closes for good. Long enough to notice and react to on a
// phone, short enough that it doesn't linger forever if ignored.
const UNDO_WINDOW_MS = 8000;

/**
 * Wraps one of Home's incomplete-round cards (ContinueRoundCard, or the
 * scheduled-round variant of UpcomingCard) with the "Round Options"
 * three-dot menu in its upper-right corner, without touching the
 * card's own markup at all -- the card is passed in as `children` and
 * rendered exactly as it already is; this only adds an absolutely
 * positioned overlay button in space the card was already leaving
 * empty (see ContinueRoundCard's/UpcomingCard's own layout), so nothing
 * about Home's layout changes.
 *
 * Owns the discard/undo lifecycle itself so a discard feels instant:
 * on confirm, the card disappears immediately (optimistic -- no
 * waiting on a full page refresh) and a temporary "Round discarded —
 * Undo" toast appears; clicking Undo calls restore_round and brings
 * the card straight back with no reload. If the undo window closes
 * without a click, or after a successful undo, router.refresh() syncs
 * with the server so every other page that could show this round
 * (Home's own balances aside, which never depend on rounds) reflects
 * the real, current state on next navigation.
 */
export function ActiveRoundCardShell({
  tripId,
  roundId,
  canDiscard,
  viewHref,
  editHref,
  variant = "light",
  children,
}: {
  tripId: string;
  roundId: string;
  canDiscard: boolean;
  viewHref: string;
  editHref: string;
  variant?: "light" | "dark";
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [hidden, setHidden] = useState(false);
  const [showUndo, setShowUndo] = useState(false);
  const [undoError, setUndoError] = useState<string | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (undoTimer.current) clearTimeout(undoTimer.current);
    };
  }, []);

  async function handleDiscard() {
    const result = await discardRoundAction(tripId, roundId);
    if (result.status === "error") {
      throw new Error(result.message ?? "Couldn't discard this round. Please try again.");
    }
    setHidden(true);
    setShowUndo(true);
    setUndoError(null);
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => {
      setShowUndo(false);
      router.refresh();
    }, UNDO_WINDOW_MS);
  }

  async function handleUndo() {
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setShowUndo(false);
    const result = await restoreRoundAction(tripId, roundId);
    if (result.status === "error") {
      // The round is still discarded from this card's point of view --
      // surface the failure rather than silently reappearing.
      setUndoError(result.message ?? "Couldn't undo. Please refresh the page.");
      setTimeout(() => setUndoError(null), 6000);
      return;
    }
    setHidden(false);
    router.refresh();
  }

  return (
    <>
      {!hidden && (
        <div className="relative">
          {children}
          <div className="absolute right-3 top-3 sm:right-4 sm:top-4">
            <RoundOptionsMenu
              viewHref={viewHref}
              editHref={editHref}
              canDiscard={canDiscard}
              variant={variant}
              onDiscard={handleDiscard}
            />
          </div>
        </div>
      )}

      {showUndo && (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-x-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-50 mx-auto flex max-w-sm items-center justify-between gap-3 rounded-lg bg-charcoal-900 px-4 py-3 text-base text-cream-50 shadow-lg sm:inset-x-auto sm:bottom-6 sm:right-6"
        >
          <span>Round discarded —</span>
          <button type="button" onClick={handleUndo} className="shrink-0 font-semibold text-gold-300 hover:text-gold-200">
            Undo
          </button>
        </div>
      )}

      {undoError && (
        <div
          role="alert"
          className="fixed inset-x-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-50 mx-auto max-w-sm rounded-lg bg-red-700 px-4 py-3 text-base text-white shadow-lg sm:inset-x-auto sm:bottom-6 sm:right-6"
        >
          {undoError}
        </div>
      )}
    </>
  );
}
