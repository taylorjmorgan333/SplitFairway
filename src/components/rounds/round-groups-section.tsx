"use client";

import { useActionState, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { MoreVertical } from "lucide-react";
import { createRoundGroupAction, deleteRoundGroupAction } from "@/actions/rounds";
import type { ActionState } from "@/actions/auth";
import type { Tables } from "@/lib/supabase/database.types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Dialog } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

const initialState: ActionState = { status: "idle" };

export type PlayingGroupMember = { id: string; displayName: string; groupId: string | null };

function AddGroupButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending} className="w-full sm:w-auto">
      {pending ? "Adding…" : "Add Group"}
    </Button>
  );
}

function AddGroupDialog({ roundId, open, onOpenChange }: { roundId: string; open: boolean; onOpenChange: (v: boolean) => void }) {
  const action = createRoundGroupAction.bind(null, roundId);
  const [state, formAction] = useActionState(action, initialState);

  return (
    <Dialog open={open} onClose={() => onOpenChange(false)} title="Add Another Group">
      <form action={formAction} className="space-y-4" noValidate>
        {state.status === "error" && state.message && <Alert variant="error">{state.message}</Alert>}
        <div>
          <label htmlFor="groupLabel" className="mb-1.5 block text-sm font-medium text-forest-900">
            Group name
          </label>
          <Input id="groupLabel" name="label" placeholder="Bandon Boys" required />
          {state.status === "error" && state.fieldErrors?.label && (
            <p className="mt-1.5 text-xs text-red-600">{state.fieldErrors.label[0]}</p>
          )}
        </div>
        <div>
          <label htmlFor="startingHole" className="mb-1.5 block text-sm font-medium text-forest-900">
            Starting hole
          </label>
          <Input id="startingHole" name="startingHole" type="number" min={1} max={18} defaultValue={1} />
        </div>
        <AddGroupButton />
      </form>
    </Dialog>
  );
}

function GroupCardMenu({ groupId, groupLabel }: { groupId: string; groupLabel: string }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [, startTransition] = useTransition();

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-label={`Options for ${groupLabel}`}
        className="flex h-11 w-11 items-center justify-center rounded-full text-charcoal-400 hover:bg-cream-100 hover:text-charcoal-700"
      >
        <MoreVertical className="h-5 w-5" aria-hidden="true" />
      </button>
      {menuOpen && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-lg border border-forest-900/10 bg-white shadow-lg"
          onMouseLeave={() => setMenuOpen(false)}
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false);
              setConfirmOpen(true);
            }}
            className="block min-h-11 w-full px-4 py-2.5 text-left text-sm text-red-700 hover:bg-red-50"
          >
            Remove group
          </button>
        </div>
      )}
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Remove ${groupLabel}?`}
        description="Golfers in this group will become unassigned, not removed from the round."
        confirmLabel="Remove Group"
        cancelLabel="Keep Group"
        onConfirm={() =>
          new Promise<void>((resolve, reject) => {
            startTransition(async () => {
              try {
                await deleteRoundGroupAction(groupId);
                resolve();
              } catch (err) {
                reject(err);
              }
            });
          })
        }
      />
    </div>
  );
}

/**
 * "Playing Groups" -- foursomes with their own starting hole. Replaces
 * the old always-visible add-group form (a wall of fields shown even
 * when a captain has nothing to add yet) with a single "Add Another
 * Group" button that opens a small dialog, and shows each group as a
 * card with its assigned golfers as chips instead of a bare label, so
 * "who's actually in this group" is visible without opening every
 * player's own card.
 */
export function RoundGroupsSection({
  roundId,
  groups,
  players,
  canEdit,
}: {
  roundId: string;
  groups: Tables<"round_groups">[];
  players: PlayingGroupMember[];
  canEdit: boolean;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const unassignedCount = players.filter((p) => !p.groupId).length;

  return (
    <div className="space-y-3">
      {groups.length === 0 ? (
        <p className="text-sm text-charcoal-500">
          No playing groups yet — every golfer plays together, or add groups to split into
          foursomes with their own starting holes.
        </p>
      ) : (
        <>
          <p className="text-sm text-charcoal-500">
            {unassignedCount === 0
              ? "All golfers are assigned to a playing group."
              : `${unassignedCount} ${unassignedCount === 1 ? "golfer" : "golfers"} still ${unassignedCount === 1 ? "needs" : "need"} a group.`}
          </p>
          <ul className="space-y-2">
            {groups
              .slice()
              .sort((a, b) => a.sort_order - b.sort_order)
              .map((group) => {
                const members = players.filter((p) => p.groupId === group.id);
                return (
                  <li key={group.id} className="rounded-xl border border-charcoal-400/15 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-base font-medium text-forest-900">{group.label}</p>
                        <p className="mt-0.5 text-sm text-charcoal-500">
                          Starts on Hole {group.starting_hole} · {members.length}{" "}
                          {members.length === 1 ? "player" : "players"}
                        </p>
                      </div>
                      {canEdit && <GroupCardMenu groupId={group.id} groupLabel={group.label} />}
                    </div>
                    {members.length > 0 && (
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {members.map((m) => (
                          <span
                            key={m.id}
                            className="rounded-full bg-cream-100 px-2.5 py-1 text-xs font-medium text-charcoal-700"
                          >
                            {m.displayName}
                          </span>
                        ))}
                      </div>
                    )}
                  </li>
                );
              })}
          </ul>
        </>
      )}

      {canEdit && (
        <Button type="button" variant="outline" size="lg" onClick={() => setAddOpen(true)} className="w-full sm:w-auto">
          Add Another Group
        </Button>
      )}

      {canEdit && <AddGroupDialog roundId={roundId} open={addOpen} onOpenChange={setAddOpen} />}
    </div>
  );
}
