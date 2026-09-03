"use client";

import { useActionState, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { createRoundGroupAction, deleteRoundGroupAction } from "@/actions/rounds";
import type { ActionState } from "@/actions/auth";
import type { Tables } from "@/lib/supabase/database.types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

const initialState: ActionState = { status: "idle" };

function AddButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="outline" size="sm" disabled={pending}>
      {pending ? "Adding…" : "Add group"}
    </Button>
  );
}

function DeleteGroupButton({ groupId }: { groupId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      {error && <span className="text-xs text-red-600">{error}</span>}
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            try {
              await deleteRoundGroupAction(groupId);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Couldn't remove that group.");
            }
          });
        }}
        className="text-xs text-red-700 underline hover:no-underline disabled:opacity-50"
      >
        {isPending ? "Removing…" : "Remove"}
      </button>
    </>
  );
}

export function RoundGroupsSection({
  roundId,
  groups,
  canEdit,
}: {
  roundId: string;
  groups: Tables<"round_groups">[];
  canEdit: boolean;
}) {
  const action = createRoundGroupAction.bind(null, roundId);
  const [state, formAction] = useActionState(action, initialState);

  return (
    <div className="space-y-3">
      {groups.length === 0 ? (
        <p className="text-sm text-charcoal-400">
          No groups yet — every golfer plays together, or add groups to split into foursomes with
          their own starting holes.
        </p>
      ) : (
        <ul className="space-y-2">
          {groups
            .slice()
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((group) => (
              <li
                key={group.id}
                className="flex items-center justify-between rounded-lg bg-cream-100 px-3 py-2 text-sm"
              >
                <span>
                  {group.label} <span className="text-charcoal-400">· starts hole {group.starting_hole}</span>
                </span>
                {canEdit && <DeleteGroupButton groupId={group.id} />}
              </li>
            ))}
        </ul>
      )}

      {canEdit && (
        <form action={formAction} className="flex flex-wrap items-end gap-3 border-t border-charcoal-400/10 pt-3">
          <div className="min-w-[8rem] flex-1">
            <label htmlFor="groupLabel" className="text-xs font-medium text-charcoal-500">
              Group name
            </label>
            <Input id="groupLabel" name="label" placeholder="Group 1" className="mt-1" required />
          </div>
          <div className="w-24">
            <label htmlFor="startingHole" className="text-xs font-medium text-charcoal-500">
              Starting hole
            </label>
            <Input
              id="startingHole"
              name="startingHole"
              type="number"
              min={1}
              max={18}
              defaultValue={1}
              className="mt-1"
            />
          </div>
          <AddButton />
          {state.status === "error" && state.message && (
            <Alert variant="error" className="w-full">
              {state.message}
            </Alert>
          )}
        </form>
      )}
    </div>
  );
}
