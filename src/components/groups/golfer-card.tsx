"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { AddGroupMemberForm } from "@/components/groups/add-group-member-form";
import { RemoveGroupMemberButton } from "@/components/groups/group-management";
import { formatDate } from "@/lib/utils";

export interface GolferRoundRow {
  id: string;
  tripId: string;
  courseName: string;
  roundDate: string;
}

export interface GolferStats {
  roundsPlayed: number;
  grossAvg: number;
  netAvg: number;
  wins: number;
}

/**
 * One saved golfer's row on the Golfers tab (spec item 5): name,
 * handicap, preferred tee, member/guest status (a "member" here just
 * means this golfer has their own SplitFairway account -- user_id is
 * set -- vs. a "guest" the captain added by name only; there's no
 * separate stored tier), round history, and group statistics. Editing
 * only ever changes what a *future* round pre-fills -- see the doc
 * comment on AddGroupMemberForm/updateGroupMemberAction.
 */
export function GolferCard({
  groupId,
  isOwner,
  isMe,
  member,
  stats,
  rounds,
}: {
  groupId: string;
  isOwner: boolean;
  isMe: boolean;
  member: {
    id: string;
    userId: string | null;
    displayName: string;
    email: string | null;
    role: "owner" | "member";
    defaultHandicapIndex: number | null;
    preferredTeeName: string | null;
  };
  stats: GolferStats | null;
  rounds: GolferRoundRow[];
}) {
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);

  if (editing) {
    return (
      <div className="p-5">
        <AddGroupMemberForm
          groupId={groupId}
          initialValues={{
            id: member.id,
            displayName: member.displayName,
            email: member.email,
            defaultHandicapIndex: member.defaultHandicapIndex,
            preferredTeeName: member.preferredTeeName,
          }}
          onSaved={() => setEditing(false)}
        />
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="mt-3 text-sm font-medium text-charcoal-500 underline hover:no-underline"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="p-5">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="min-w-0 flex-1 text-left"
        >
          <p className="text-base font-medium text-forest-900">
            {member.displayName}
            {member.role === "owner" && (
              <Badge variant="forest" className="ml-2 align-middle">
                Owner
              </Badge>
            )}
            <Badge variant="neutral" className="ml-2 align-middle">
              {member.userId ? "Member" : "Guest"}
            </Badge>
          </p>
          <p className="mt-0.5 text-sm text-charcoal-500">
            {[
              member.defaultHandicapIndex != null ? `Handicap ${member.defaultHandicapIndex}` : null,
              member.preferredTeeName ? `${member.preferredTeeName} tees` : null,
              stats ? `${stats.roundsPlayed} ${stats.roundsPlayed === 1 ? "round" : "rounds"}` : null,
            ]
              .filter(Boolean)
              .join(" · ") || "No handicap or tee saved"}
          </p>
        </button>
        <div className="flex shrink-0 items-center gap-1">
          {(isOwner || isMe) && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="h-11 rounded-full px-3 text-sm font-medium text-forest-700 underline hover:no-underline"
            >
              Edit
            </button>
          )}
          {isOwner && !isMe && (
            <RemoveGroupMemberButton groupId={groupId} memberId={member.id} displayName={member.displayName} />
          )}
        </div>
      </div>

      {expanded && (
        <div className="mt-4 space-y-4 border-t border-cream-200 pt-4">
          {stats && stats.roundsPlayed > 0 ? (
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-lg font-semibold text-forest-900">{stats.grossAvg}</p>
                <p className="text-xs text-charcoal-500">Gross avg</p>
              </div>
              <div>
                <p className="text-lg font-semibold text-forest-900">{stats.netAvg}</p>
                <p className="text-xs text-charcoal-500">Net avg</p>
              </div>
              <div>
                <p className="text-lg font-semibold text-forest-900">{stats.wins}</p>
                <p className="text-xs text-charcoal-500">Wins</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-charcoal-500">
              {member.userId
                ? "No completed rounds with this group yet."
                : "Guest golfers' stats aren't tracked across rounds -- see each round's own results for their scores."}
            </p>
          )}

          {rounds.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-charcoal-400">
                Round history
              </p>
              <ul className="space-y-1.5">
                {rounds.slice(0, 5).map((r) => (
                  <li key={r.id}>
                    <Link
                      href={`/trips/${r.tripId}/rounds/${r.id}`}
                      className="text-sm text-forest-700 underline hover:no-underline"
                    >
                      {r.courseName} · {formatDate(r.roundDate)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
