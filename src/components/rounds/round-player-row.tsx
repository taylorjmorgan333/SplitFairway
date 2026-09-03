"use client";

import { useActionState, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { updateRoundPlayerAction, removeRoundPlayerAction } from "@/actions/rounds";
import type { ActionState } from "@/actions/auth";
import type { Tables } from "@/lib/supabase/database.types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";

const initialState: ActionState = { status: "idle" };

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="outline" size="sm" disabled={pending}>
      {pending ? "Saving…" : "Save"}
    </Button>
  );
}

export function RoundPlayerRow({
  roundId,
  player,
  displayName,
  teeSetNames,
  groups,
  canEdit,
  canRemove,
}: {
  roundId: string;
  player: Tables<"round_players">;
  displayName: string;
  teeSetNames: string[];
  groups: Tables<"round_groups">[];
  canEdit: boolean;
  canRemove: boolean;
}) {
  const action = updateRoundPlayerAction.bind(null, roundId, player.id);
  const [state, formAction] = useActionState(action, initialState);
  const [isRemoving, startTransition] = useTransition();
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [removed, setRemoved] = useState(false);

  if (removed) return null;

  return (
    <div className="rounded-lg border border-charcoal-400/15 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-forest-900">{displayName}</p>
          {player.profile_handicap_index != null && (
            <p className="text-xs text-charcoal-400">
              Profile handicap at add-time: {player.profile_handicap_index.toFixed(1)}
              {player.profile_handicap_source === "ghin_screenshot_import" ? (
                <Badge variant="forest" className="ml-1.5">
                  GHIN import
                </Badge>
              ) : null}
            </p>
          )}
        </div>
        {canRemove && (
          <div className="flex items-center gap-2">
            {removeError && <span className="text-xs text-red-600">{removeError}</span>}
            <button
              type="button"
              disabled={isRemoving}
              onClick={() => {
                setRemoveError(null);
                startTransition(async () => {
                  try {
                    await removeRoundPlayerAction(roundId, player.id);
                    setRemoved(true);
                  } catch (err) {
                    setRemoveError(err instanceof Error ? err.message : "Couldn't remove that golfer.");
                  }
                });
              }}
              className="text-xs text-red-700 underline hover:no-underline disabled:opacity-50"
            >
              {isRemoving ? "Removing…" : "Remove"}
            </button>
          </div>
        )}
      </div>

      {canEdit ? (
        <form action={formAction} className="mt-3 flex flex-wrap items-end gap-3">
          {teeSetNames.length > 0 && (
            <div className="min-w-[7rem]">
              <label className="text-xs font-medium text-charcoal-500">Tees</label>
              <select
                name="teeSetName"
                defaultValue={player.tee_set_name ?? ""}
                className="mt-1 h-10 w-full rounded-lg border border-charcoal-400/25 bg-white px-2.5 text-sm focus:border-forest-600"
              >
                <option value="">Not set</option>
                {teeSetNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="w-24">
            <label className="text-xs font-medium text-charcoal-500">Playing hcp</label>
            <input
              name="playingHandicap"
              defaultValue={player.playing_handicap != null ? String(player.playing_handicap) : ""}
              className="mt-1 h-10 w-full rounded-lg border border-charcoal-400/25 bg-white px-2.5 text-sm focus:border-forest-600"
            />
          </div>
          {groups.length > 0 && (
            <div className="min-w-[7rem]">
              <label className="text-xs font-medium text-charcoal-500">Group</label>
              <select
                name="groupId"
                defaultValue={player.group_id ?? ""}
                className="mt-1 h-10 w-full rounded-lg border border-charcoal-400/25 bg-white px-2.5 text-sm focus:border-forest-600"
              >
                <option value="">Ungrouped</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.label}
                  </option>
                ))}
              </select>
            </div>
          )}
          <SaveButton />
          {state.status === "error" && state.message && (
            <Alert variant="error" className="w-full">
              {state.message}
            </Alert>
          )}
        </form>
      ) : (
        <p className="mt-2 text-xs text-charcoal-400">
          {player.tee_set_name ? `${player.tee_set_name} tees` : "Tees not set"}
          {player.playing_handicap != null ? ` · playing handicap ${player.playing_handicap}` : ""}
        </p>
      )}
    </div>
  );
}
