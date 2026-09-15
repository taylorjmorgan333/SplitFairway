"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { MoreVertical } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";

/**
 * The three-dot "Round Options" menu on every incomplete-round card
 * (Home's "Round in progress" card and its upcoming/scheduled-round
 * card -- see ActiveRoundCardShell, which wraps this around each one).
 * Follows the exact same menu/confirm-dialog pattern already used for
 * "Player options" on RoundPlayerRow: a small round button, a
 * click-outside-to-close dropdown, and a real confirmation dialog
 * before anything destructive happens -- never a bare "OK".
 *
 * "View Round Details" and "Edit Round" are plain navigation, always
 * shown to anyone who can see the card. "Discard Round" is the one
 * item actually gated by canDiscard (creator-only for a Quick Round,
 * captain-only for a Group/Trip Round -- see round-discard-permission.ts)
 * -- hiding it here is a UI nicety only, since discard_round() enforces
 * the real rule in the database regardless of whether this button is
 * visible.
 */
export function RoundOptionsMenu({
  viewHref,
  editHref,
  canDiscard,
  variant = "light",
  onDiscard,
}: {
  viewHref: string;
  editHref: string;
  canDiscard: boolean;
  variant?: "light" | "dark";
  onDiscard: () => void | Promise<void>;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onDocPointer(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDocPointer);
    return () => document.removeEventListener("mousedown", onDocPointer);
  }, [menuOpen]);

  return (
    <>
      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-label="Round options"
          className={cn(
            "flex h-11 w-11 items-center justify-center rounded-full transition-colors",
            variant === "dark"
              ? "text-cream-100/80 hover:bg-white/10 hover:text-cream-50"
              : "text-charcoal-400 hover:bg-cream-100 hover:text-charcoal-700",
          )}
        >
          <MoreVertical className="h-5 w-5" aria-hidden="true" />
        </button>
        {menuOpen && (
          <div
            role="menu"
            className="absolute right-0 z-20 mt-1 w-52 overflow-hidden rounded-lg border border-forest-900/10 bg-white shadow-lg"
          >
            <Link
              href={viewHref}
              role="menuitem"
              onClick={() => setMenuOpen(false)}
              className="block min-h-11 w-full px-4 py-2.5 text-left text-base leading-[2.75rem] text-forest-900 hover:bg-cream-100"
            >
              View Round Details
            </Link>
            <Link
              href={editHref}
              role="menuitem"
              onClick={() => setMenuOpen(false)}
              className="block min-h-11 w-full px-4 py-2.5 text-left text-base leading-[2.75rem] text-forest-900 hover:bg-cream-100"
            >
              Edit Round
            </Link>
            {canDiscard && (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  setConfirmOpen(true);
                }}
                className="block min-h-11 w-full border-t border-charcoal-400/10 px-4 py-2.5 text-left text-base text-red-700 hover:bg-red-50"
              >
                Discard Round
              </button>
            )}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Discard this round?"
        description="Scores and game results recorded for this round will be removed. Your saved course, golfers, group and trip information will not be affected."
        confirmLabel="Discard Round"
        cancelLabel="Keep Round"
        onConfirm={onDiscard}
      />
    </>
  );
}
