"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { addRoundPlayerAction } from "@/actions/rounds";
import type { ActionState } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { InfoTip } from "@/components/ui/info-tip";

const initialState: ActionState = { status: "idle" };

function AddButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending} className="w-full sm:w-auto">
      {pending ? "Adding…" : "Add Golfer"}
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
      <p className="text-sm text-charcoal-500">
        Every active golfer on this trip is already in this round.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-3" noValidate>
      <p className="text-sm font-medium text-forest-900">Add a golfer to this round</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="tripMemberId" className="mb-1 block text-sm font-medium text-forest-900">
            Golfer
          </label>
          <select
            id="tripMemberId"
            name="tripMemberId"
            required
            defaultValue=""
            className="h-11 w-full rounded-lg border border-charcoal-400/25 bg-white px-3 text-base text-charcoal focus:border-forest-600"
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
          <div>
            <label htmlFor="teeSetName" className="mb-1 block text-sm font-medium text-forest-900">
              Tees
            </label>
            <select
              id="teeSetName"
              name="teeSetName"
              defaultValue=""
              className="h-11 w-full rounded-lg border border-charcoal-400/25 bg-white px-3 text-base text-charcoal focus:border-forest-600"
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

        <div>
          <label htmlFor="playingHandicap" className="mb-1 flex items-center gap-1 text-sm font-medium text-forest-900">
            Playing handicap
            <InfoTip label="What is a playing handicap?">
              The playing handicap is the number used for this round. Changing it here will not
              change the golfer&apos;s profile.
            </InfoTip>
          </label>
          <input
            id="playingHandicap"
            name="playingHandicap"
            placeholder="Auto from profile"
            inputMode="decimal"
            className="h-11 w-full rounded-lg border border-charcoal-400/25 bg-white px-3 text-base focus:border-forest-600"
          />
        </div>
      </div>

      <AddButton />
      {state.status === "error" && state.message && <Alert variant="error">{state.message}</Alert>}
    </form>
  );
}
