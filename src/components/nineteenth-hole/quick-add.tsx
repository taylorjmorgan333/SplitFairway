"use client";

import { useEffect, useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";
import { recordNineteenthHoleActivityAction } from "@/actions/nineteenth-hole";
import type {
  NineteenthHoleActivityEntry,
  NineteenthHoleCounter,
  NineteenthHoleMember,
  NineteenthHoleRound,
} from "@/components/nineteenth-hole/types";

/**
 * "3 drinks" / "1 drink" from a plural-by-default counter label like
 * "Drinks" -- a deliberately simple singularizer (strip a trailing "s")
 * rather than a full pluralization library, since every default label
 * and the obvious custom ones ("Mulligans", "Bad Jokes") are already
 * plain plural nouns.
 */
function formatCount(label: string, count: number): string {
  const lower = label.toLowerCase();
  if (count === 1 && lower.endsWith("s")) {
    return `1 ${lower.slice(0, -1)}`;
  }
  return `${count} ${lower}`;
}

export function NineteenthHoleQuickAdd({
  tripId,
  currentUserId,
  canRecord,
  members,
  rounds,
  counters,
  activity,
  selectedCounterId,
  onSelectCounter,
  selectedRoundId,
  onSelectRound,
  onActivityAdded,
  onActivityCorrected,
}: {
  tripId: string;
  currentUserId: string;
  /** Whether the signed-in user is allowed to record activity, per the
   * captain's "who can record" setting. RLS enforces this either way --
   * this just keeps regular golfers from tapping a button that would
   * only ever come back as an error when captains-only is turned on. */
  canRecord: boolean;
  members: NineteenthHoleMember[];
  rounds: NineteenthHoleRound[];
  counters: NineteenthHoleCounter[];
  activity: NineteenthHoleActivityEntry[];
  selectedCounterId: string | null;
  onSelectCounter: (counterId: string) => void;
  selectedRoundId: string | null;
  onSelectRound: (roundId: string | null) => void;
  onActivityAdded: (entry: NineteenthHoleActivityEntry) => void;
  onActivityCorrected: (activityId: string) => void;
}) {
  const activeCounters = [...counters].filter((c) => c.isActive).sort((a, b) => a.sortOrder - b.sortOrder);
  const selectedCounter = activeCounters.find((c) => c.id === selectedCounterId) ?? activeCounters[0] ?? null;

  const [pendingMemberId, setPendingMemberId] = useState<string | null>(null);
  const [confirmMinusFor, setConfirmMinusFor] = useState<NineteenthHoleMember | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastAdded, setLastAdded] = useState<{
    activityId: string;
    memberName: string;
    counterLabel: string;
  } | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (undoTimer.current) clearTimeout(undoTimer.current);
    };
  }, []);

  function showUndoBriefly(activityId: string, memberName: string, counterLabel: string) {
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setLastAdded({ activityId, memberName, counterLabel });
    undoTimer.current = setTimeout(() => setLastAdded(null), 6000);
  }

  function countFor(memberId: string, counterId: string): number {
    return activity
      .filter((a) => a.deletedAt === null && a.tripMemberId === memberId && a.counterId === counterId)
      .reduce((sum, a) => sum + a.quantity, 0);
  }

  async function addOne(member: NineteenthHoleMember) {
    if (!selectedCounter || pendingMemberId) return;
    setError(null);
    setPendingMemberId(member.id);
    const result = await recordNineteenthHoleActivityAction(tripId, {
      tripMemberId: member.id,
      counterId: selectedCounter.id,
      roundId: selectedRoundId,
      quantity: 1,
    });
    setPendingMemberId(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onActivityAdded({
      id: result.activity.id,
      tripMemberId: member.id,
      counterId: selectedCounter.id,
      roundId: selectedRoundId,
      quantity: 1,
      recordedBy: currentUserId,
      createdAt: result.activity.createdAt,
      deletedAt: null,
    });
    showUndoBriefly(result.activity.id, member.displayName, selectedCounter.label);
  }

  async function removeOne(member: NineteenthHoleMember) {
    if (!selectedCounter || pendingMemberId) return;
    setError(null);
    setPendingMemberId(member.id);
    const result = await recordNineteenthHoleActivityAction(tripId, {
      tripMemberId: member.id,
      counterId: selectedCounter.id,
      roundId: selectedRoundId,
      quantity: -1,
    });
    setPendingMemberId(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onActivityAdded({
      id: result.activity.id,
      tripMemberId: member.id,
      counterId: selectedCounter.id,
      roundId: selectedRoundId,
      quantity: -1,
      recordedBy: currentUserId,
      createdAt: result.activity.createdAt,
      deletedAt: null,
    });
  }

  if (activeCounters.length === 0) {
    return (
      <p className="text-sm text-charcoal-500">
        No counters are active. A captain can turn some on from Configure above.
      </p>
    );
  }

  if (!canRecord) {
    return (
      <p className="text-sm text-charcoal-500">
        Only trip captains can record 19th Hole activity right now. Ask a captain to add it, or to change
        this from Configure above.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {/* -mx-5 px-5 bleeds the pill row to the screen edge and scrolls
          horizontally on a phone, matching the tab-row idiom used
          elsewhere (round-nav, trip-tabs) instead of wrapping awkwardly. */}
      <div className="-mx-5 overflow-x-auto px-5 sm:mx-0 sm:px-0">
        <div className="flex w-fit gap-1.5">
          {activeCounters.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onSelectCounter(c.id)}
              className={cn(
                "shrink-0 whitespace-nowrap rounded-full px-4 py-2.5 text-base font-medium transition-colors",
                selectedCounter?.id === c.id
                  ? "bg-forest-800 text-cream-50"
                  : "bg-cream-100 text-charcoal-600 hover:bg-cream-200",
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {rounds.length > 0 && (
        <div>
          <label className="mb-1 block text-xs font-medium text-charcoal-500" htmlFor="quickAddRound">
            Attach new entries to
          </label>
          <select
            id="quickAddRound"
            value={selectedRoundId ?? ""}
            onChange={(e) => onSelectRound(e.target.value || null)}
            className="h-11 w-full rounded-lg border border-charcoal-400/25 bg-white px-3.5 text-base text-charcoal focus:border-forest-600 sm:w-auto"
          >
            <option value="">No round (general trip activity)</option>
            {rounds.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {lastAdded && (
        <div className="flex items-center justify-between gap-3 rounded-xl bg-forest-800 px-4 py-3 text-cream-50">
          <p className="text-sm">
            Added 1 {lastAdded.counterLabel.toLowerCase()} for {lastAdded.memberName}
          </p>
          <button
            type="button"
            onClick={() => {
              onActivityCorrected(lastAdded.activityId);
              setLastAdded(null);
            }}
            className="shrink-0 rounded-full bg-white/15 px-3.5 py-1.5 text-sm font-medium hover:bg-white/25"
          >
            Undo
          </button>
        </div>
      )}

      {selectedCounter && (
        <ul className="space-y-2">
          {members.map((member) => {
            const count = countFor(member.id, selectedCounter.id);
            const isPending = pendingMemberId === member.id;
            return (
              <li
                key={member.id}
                className="flex items-center justify-between gap-3 rounded-xl bg-white p-3 shadow-card"
              >
                <div className="min-w-0">
                  <p className="truncate text-base font-medium text-charcoal">{member.displayName}</p>
                  <p className="text-sm text-charcoal-500">{formatCount(selectedCounter.label, count)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2.5">
                  <button
                    type="button"
                    disabled={isPending || count <= 0}
                    onClick={() => setConfirmMinusFor(member)}
                    aria-label={`Remove one ${selectedCounter.label} from ${member.displayName}`}
                    className="flex h-11 w-11 items-center justify-center rounded-full bg-cream-100 text-charcoal-500 active:bg-cream-200 disabled:opacity-30"
                  >
                    <Minus className="h-5 w-5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => addOne(member)}
                    aria-label={`Add one ${selectedCounter.label} for ${member.displayName}`}
                    className="flex h-14 w-14 items-center justify-center rounded-full bg-forest-800 text-cream-50 shadow-card active:bg-forest-900 disabled:opacity-50"
                  >
                    <Plus className="h-6 w-6" aria-hidden="true" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        open={confirmMinusFor !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmMinusFor(null);
        }}
        title={`Remove one ${selectedCounter?.label ?? "entry"}?`}
        description={
          confirmMinusFor
            ? `This lowers ${confirmMinusFor.displayName}'s ${selectedCounter?.label.toLowerCase()} total by 1 and is recorded as its own activity entry.`
            : ""
        }
        confirmLabel="Remove one"
        onConfirm={async () => {
          if (confirmMinusFor) await removeOne(confirmMinusFor);
        }}
      />
    </div>
  );
}
