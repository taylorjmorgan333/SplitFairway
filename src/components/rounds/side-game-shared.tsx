"use client";

import { useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { deleteSideGameAction } from "@/actions/side-games";
import type { ActionState } from "@/actions/auth";
import { MONETARY_GAME_NOTICE } from "@/lib/golf/money-notice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Bits shared by every side-game create form/card -- originally all
 * lived inline in side-games-section.tsx (Nassau + skins only); pulled
 * out here once wolf/vegas/quota/nines/twos needed the exact same
 * money-toggle, submit-button, and delete-button pieces, so every game's
 * card looks and behaves identically instead of six near-duplicate copies.
 */

export const initialState: ActionState = { status: "idle" };

export interface PlayerOption {
  roundPlayerId: string;
  displayName: string;
}

export function formatDollars(value: number | null): string {
  if (value == null) return "";
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: value % 1 === 0 ? 0 : 2 })}`;
}

/** The dollar-value + accept-notice fields, shown inline in a create form once "Play for money" is checked. */
export function MonetarySection({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div className="space-y-3 rounded-lg bg-cream-100 p-3">
      <div className="max-w-[10rem]">
        <Label htmlFor="dollarValue">Dollar value</Label>
        <Input id="dollarValue" name="dollarValue" type="number" min="0.01" step="0.01" placeholder="20.00" />
      </div>
      <p className="text-xs text-charcoal-500">{MONETARY_GAME_NOTICE}</p>
      <label className="flex items-start gap-2 text-xs text-charcoal-700">
        <input type="checkbox" name="monetaryNoticeAccepted" required className="mt-0.5" />
        <span>I&apos;ve read this and everyone in the game agrees.</span>
      </label>
    </div>
  );
}

export function MonetaryToggle({
  monetaryEnabled,
  isMonetary,
  onChange,
}: {
  monetaryEnabled: boolean;
  isMonetary: boolean;
  onChange: (value: boolean) => void;
}) {
  if (!monetaryEnabled) return null;
  return (
    <label className="flex items-center gap-2 text-sm text-charcoal-700">
      <input
        type="checkbox"
        name="isMonetary"
        checked={isMonetary}
        onChange={(e) => onChange(e.target.checked)}
      />
      Play for money
    </label>
  );
}

export function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="outline" size="sm" disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

export function DeleteGameButton({
  roundId,
  tripId,
  gameId,
  gameName,
}: {
  roundId: string;
  tripId: string;
  gameId: string;
  gameName: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-2">
      {error && <span className="text-xs text-red-600">{error}</span>}
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          if (!window.confirm(`Delete "${gameName}"? This removes it for everyone in this round.`)) return;
          setError(null);
          startTransition(async () => {
            try {
              await deleteSideGameAction(roundId, tripId, gameId);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Couldn't delete this game.");
            }
          });
        }}
        className="text-xs text-red-700 underline hover:no-underline disabled:opacity-50"
      >
        {isPending ? "Deleting…" : "Delete"}
      </button>
    </div>
  );
}
