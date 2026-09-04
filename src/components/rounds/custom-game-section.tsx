"use client";

import { useEffect, useState } from "react";
import { useActionState } from "react";
import { createCustomGameAction } from "@/actions/side-games";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  initialState,
  formatDollars,
  MonetaryToggle,
  MonetarySection,
  SubmitButton,
  DeleteGameButton,
  type PlayerOption,
} from "@/components/rounds/side-game-shared";

/**
 * "Custom Game" -- the redesign's freeform option for anything that
 * isn't one of the built-in formats. Deliberately the simplest create
 * form in the app: a name, who's playing (optional), and an optional
 * dollar value. No scoring engine runs behind it -- the group notes
 * what they're playing and tracks/settles the result themselves, same
 * as they would on a scorecard's blank margin.
 */
export function CreateCustomForm({
  roundId,
  tripId,
  players,
  monetaryEnabled,
  onSuccess,
}: {
  roundId: string;
  tripId: string;
  players: PlayerOption[];
  monetaryEnabled: boolean;
  onSuccess?: () => void;
}) {
  const action = createCustomGameAction.bind(null, roundId, tripId);
  const [state, formAction] = useActionState(action, initialState);
  const [isMonetary, setIsMonetary] = useState(false);

  useEffect(() => {
    if (state.status === "success") onSuccess?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status]);

  return (
    <form action={formAction} className="space-y-3">
      <p className="text-sm text-charcoal-500">
        For anything that isn&apos;t one of the formats above. SplitFairway won&apos;t score this one
        automatically — your group tracks and settles it directly.
      </p>

      <div>
        <Label htmlFor="customName">What are you playing?</Label>
        <Input id="customName" name="name" placeholder="e.g. Closest to the pin on 7" required />
      </div>

      {players.length > 0 && (
        <div>
          <p className="text-sm font-medium text-charcoal-500">Who&apos;s in?</p>
          <div className="mt-1 space-y-1">
            {players.map((p) => (
              <label key={p.roundPlayerId} className="flex items-center gap-2 text-base text-charcoal-700">
                <input type="checkbox" name="playerIds" value={p.roundPlayerId} className="h-4 w-4" />
                {p.displayName}
              </label>
            ))}
          </div>
          <p className="mt-1 text-xs text-charcoal-400">Optional — leave everyone unchecked to mean the whole group.</p>
        </div>
      )}

      <MonetaryToggle monetaryEnabled={monetaryEnabled} isMonetary={isMonetary} onChange={setIsMonetary} />
      <MonetarySection show={monetaryEnabled && isMonetary} label="Value" />

      {state.status === "error" && state.message && <Alert variant="error">{state.message}</Alert>}
      {state.status === "error" && state.fieldErrors && (
        <Alert variant="error">{Object.values(state.fieldErrors).flat().join(" ")}</Alert>
      )}

      <SubmitButton label="Create custom game" pendingLabel="Creating…" />
    </form>
  );
}

export interface CustomGameView {
  id: string;
  name: string;
  dollarValue: number | null;
  playerNames: string[];
}

/** Read-only card for an already-created custom game -- no standings, no settlement math, just what was set up. */
export function CustomGamesSection({
  tripId,
  roundId,
  isCaptain,
  games,
}: {
  tripId: string;
  roundId: string;
  isCaptain: boolean;
  games: CustomGameView[];
}) {
  if (games.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Custom games</CardTitle>
        <CardDescription>SplitFairway doesn&apos;t score these — your group tracks and settles them directly.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {games.map((g) => (
          <div key={g.id} className="rounded-lg border border-charcoal-400/15 p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-base font-medium text-charcoal-800">{g.name}</p>
                <p className="mt-0.5 text-sm text-charcoal-500">
                  {g.playerNames.length > 0 ? g.playerNames.join(", ") : "Whole group"}
                  {g.dollarValue != null ? ` · ${formatDollars(g.dollarValue)}` : ""}
                </p>
              </div>
              {isCaptain && <DeleteGameButton roundId={roundId} tripId={tripId} gameId={g.id} gameName={g.name} />}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
