"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { correctNineteenthHoleActivityAction } from "@/actions/nineteenth-hole";
import type { NineteenthHoleActivityEntry, NineteenthHoleCounter, NineteenthHoleMember, NineteenthHoleRound } from "@/components/nineteenth-hole/types";

/** "3 minutes ago" / "yesterday" -- coarse on purpose, this list is a
 * casual trip log, not an audit report that needs to-the-second times. */
function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function ActivityRow({
  tripId,
  entry,
  memberName,
  counterLabel,
  roundLabel,
  recordedByName,
  canCorrect,
  onCorrected,
}: {
  tripId: string;
  entry: NineteenthHoleActivityEntry;
  memberName: string;
  counterLabel: string;
  roundLabel: string | null;
  recordedByName: string;
  canCorrect: boolean;
  onCorrected: () => void;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const action = entry.quantity > 0 ? "added" : "removed";
  const unit = counterLabel.toLowerCase();

  return (
    <li className="flex items-start justify-between gap-3 rounded-xl bg-white p-3 shadow-card">
      <div className="min-w-0">
        <p className="text-sm text-charcoal-700">
          <span className="font-medium text-charcoal">{recordedByName}</span> {action} 1 {unit} for{" "}
          <span className="font-medium text-charcoal">{memberName}</span>
        </p>
        <p className="mt-0.5 text-xs text-charcoal-400">
          {timeAgo(entry.createdAt)}
          {roundLabel ? ` · ${roundLabel}` : ""}
        </p>
      </div>
      {canCorrect && (
        <>
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            className="shrink-0 rounded-full px-3 py-1.5 text-xs font-medium text-charcoal-400 underline hover:text-red-700 hover:no-underline"
          >
            Remove
          </button>
          <ConfirmDialog
            open={confirmOpen}
            onOpenChange={setConfirmOpen}
            title="Remove this entry?"
            description={`This removes "${action} 1 ${unit} for ${memberName}" from the record. This can't be undone.`}
            confirmLabel="Remove entry"
            onConfirm={async () => {
              const result = await correctNineteenthHoleActivityAction(tripId, entry.id);
              if (!result.ok) {
                throw new Error(result.error);
              }
              onCorrected();
            }}
          />
        </>
      )}
    </li>
  );
}

export function NineteenthHoleActivityList({
  tripId,
  isCaptain,
  currentUserId,
  members,
  rounds,
  counters,
  activity,
  recorderNameByUserId,
  onCorrected,
  limit = 30,
}: {
  tripId: string;
  isCaptain: boolean;
  currentUserId: string;
  members: NineteenthHoleMember[];
  rounds: NineteenthHoleRound[];
  counters: NineteenthHoleCounter[];
  activity: NineteenthHoleActivityEntry[];
  recorderNameByUserId: Record<string, string>;
  onCorrected: (activityId: string) => void;
  limit?: number;
}) {
  const memberNameById = new Map(members.map((m) => [m.id, m.displayName]));
  const counterById = new Map(counters.map((c) => [c.id, c]));
  const roundLabelById = new Map(rounds.map((r) => [r.id, r.label]));

  const visible = [...activity]
    .filter((a) => a.deletedAt === null)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit);

  if (visible.length === 0) {
    return <p className="text-sm text-gold-100/80">No activity recorded yet.</p>;
  }

  return (
    <ul className="space-y-2">
      {visible.map((entry) => (
        <ActivityRow
          key={entry.id}
          tripId={tripId}
          entry={entry}
          memberName={memberNameById.get(entry.tripMemberId) ?? "Someone"}
          counterLabel={counterById.get(entry.counterId)?.label ?? "entry"}
          roundLabel={entry.roundId ? (roundLabelById.get(entry.roundId) ?? null) : null}
          recordedByName={
            entry.recordedBy ? (recorderNameByUserId[entry.recordedBy] ?? "Someone") : "Someone"
          }
          canCorrect={isCaptain || entry.recordedBy === currentUserId}
          onCorrected={() => onCorrected(entry.id)}
        />
      ))}
    </ul>
  );
}
