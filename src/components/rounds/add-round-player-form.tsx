"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { addRoundPlayerAction } from "@/actions/rounds";
import type { ActionState } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

const initialState: ActionState = { status: "idle" };

function AddButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "Adding…" : "Add golfer"}
    </Button>
  );
}

export function AddRoundPlayerForm({
  roundId,
  availableMembers,
  teeSetNames,
}: {
  roundId: string;
  availableMembers: { id: string; display_name: string }[];
  teeSetNames: string[];
}) {
  const action = addRoundPlayerAction.bind(null, roundId);
  const [state, formAction] = useActionState(action, initialState);

  if (availableMembers.length === 0) {
    return (
      <p className="text-sm text-charcoal-400">
        Every active golfer on this trip is already in this round.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="min-w-[10rem] flex-1">
        <label htmlFor="tripMemberId" className="text-xs font-medium text-charcoal-500">
          Golfer
        </label>
        <select
          id="tripMemberId"
          name="tripMemberId"
          required
          defaultValue=""
          className="mt-1 h-11 w-full rounded-lg border border-charcoal-400/25 bg-white px-3.5 text-sm text-charcoal focus:border-forest-600"
        >
          <option value="" disabled>
            Choose a golfer
          </option>
          {availableMembers.map((m) => (
            <option key={m.id} value={m.id}>
              {m.display_name}
            </option>
          ))}
        </select>
      </div>

      {teeSetNames.length > 0 && (
        <div className="min-w-[8rem]">
          <label htmlFor="teeSetName" className="text-xs font-medium text-charcoal-500">
            Tees
          </label>
          <select
            id="teeSetName"
            name="teeSetName"
            defaultValue=""
            className="mt-1 h-11 w-full rounded-lg border border-charcoal-400/25 bg-white px-3.5 text-sm text-charcoal focus:border-forest-600"
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

      <div className="w-28">
        <label htmlFor="playingHandicap" className="text-xs font-medium text-charcoal-500">
          Playing hcp
        </label>
        <input
          id="playingHandicap"
          name="playingHandicap"
          placeholder="Auto"
          className="mt-1 h-11 w-full rounded-lg border border-charcoal-400/25 bg-white px-3 text-sm focus:border-forest-600"
        />
      </div>

      <AddButton />
      {state.status === "error" && state.message && (
        <Alert variant="error" className="w-full">
          {state.message}
        </Alert>
      )}
    </form>
  );
}
