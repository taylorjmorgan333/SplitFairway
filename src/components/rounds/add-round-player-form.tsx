"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { addRoundPlayerAction, addNewGolferToRoundAction } from "@/actions/rounds";
import type { ActionState } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { InfoTip } from "@/components/ui/info-tip";
import { cn } from "@/lib/utils";

const initialState: ActionState = { status: "idle" };

function AddButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending} className="w-full sm:w-auto">
      {pending ? "Adding…" : label}
    </Button>
  );
}

function HandicapField() {
  return (
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
  );
}

function TeesField({ teeSetNames }: { teeSetNames: string[] }) {
  if (teeSetNames.length === 0) return null;
  return (
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
  );
}

function ExistingGolferForm({
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

  return (
    <form action={formAction} className="space-y-3" noValidate>
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
        <TeesField teeSetNames={teeSetNames} />
        <HandicapField />
      </div>
      <AddButton label="Add Golfer" />
      {state.status === "error" && state.message && <Alert variant="error">{state.message}</Alert>}
    </form>
  );
}

/**
 * The round-page equivalent of the trip's "Add a golfer manually"
 * option: creates a brand-new trip member (no invitation, no login
 * required) and adds them to this round in one step, via
 * addNewGolferToRoundAction. Aimed at a walk-up golfer the captain
 * never invited to the trip at all.
 */
function NewGolferForm({ tripId, roundId, teeSetNames }: { tripId: string; roundId: string; teeSetNames: string[] }) {
  const action = addNewGolferToRoundAction.bind(null, tripId, roundId);
  const [state, formAction] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-3" noValidate>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="newGolferName" className="mb-1 block text-sm font-medium text-forest-900">
            Name
          </label>
          <input
            id="newGolferName"
            name="displayName"
            type="text"
            required
            placeholder="Golfer's name"
            className="h-11 w-full rounded-lg border border-charcoal-400/25 bg-white px-3 text-base focus:border-forest-600"
          />
          {state.status === "error" && state.fieldErrors?.displayName && (
            <p className="mt-1.5 text-xs text-red-600">{state.fieldErrors.displayName[0]}</p>
          )}
        </div>
        <div>
          <label htmlFor="newGolferEmail" className="mb-1 block text-sm font-medium text-forest-900">
            Email (optional)
          </label>
          <input
            id="newGolferEmail"
            name="email"
            type="email"
            placeholder="them@example.com"
            className="h-11 w-full rounded-lg border border-charcoal-400/25 bg-white px-3 text-base focus:border-forest-600"
          />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <TeesField teeSetNames={teeSetNames} />
        <HandicapField />
      </div>
      <p className="text-xs text-charcoal-400">
        They&apos;ll be added to this trip as an active golfer right away — no email or sign-up
        needed. You can send them a real invite later if they want their own login.
      </p>
      <AddButton label="Add Golfer" />
      {state.status === "error" && state.message && <Alert variant="error">{state.message}</Alert>}
      {state.status === "success" && state.message && <Alert variant="success">{state.message}</Alert>}
    </form>
  );
}

export function AddRoundPlayerForm({
  tripId,
  roundId,
  availableMembers,
  teeSetNames,
}: {
  tripId: string;
  roundId: string;
  availableMembers: { id: string; display_name: string }[];
  teeSetNames: string[];
}) {
  const hasExisting = availableMembers.length > 0;
  const [mode, setMode] = useState<"existing" | "new">(hasExisting ? "existing" : "new");

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-forest-900">Add a golfer to this round</p>

      {hasExisting && (
        <div className="flex gap-1 rounded-full bg-cream-100 p-1 sm:w-fit">
          {(
            [
              ["existing", "Trip golfer"],
              ["new", "New golfer"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setMode(key)}
              className={cn(
                "flex-1 rounded-full px-4 py-2 text-sm font-medium transition-colors sm:flex-none",
                mode === key ? "bg-white text-forest-900 shadow-sm" : "text-charcoal-500 hover:text-forest-800",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {mode === "existing" && hasExisting ? (
        <ExistingGolferForm roundId={roundId} availableMembers={availableMembers} teeSetNames={teeSetNames} />
      ) : (
        <NewGolferForm tripId={tripId} roundId={roundId} teeSetNames={teeSetNames} />
      )}
    </div>
  );
}
