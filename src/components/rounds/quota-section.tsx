"use client";

import { useActionState, useState } from "react";
import { createQuotaGameAction } from "@/actions/side-games";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  initialState,
  formatDollars,
  MonetarySection,
  MonetaryToggle,
  SubmitButton,
  DeleteGameButton,
  type PlayerOption,
} from "@/components/rounds/side-game-shared";

export interface QuotaPlayerView {
  roundPlayerId: string;
  displayName: string;
  target: number;
  points: number;
  differential: number;
  holesCompleted: number;
}

export interface QuotaGameView {
  id: string;
  name: string;
  isMonetary: boolean;
  /** Ante per golfer, not a per-point value. */
  dollarValue: number | null;
  /** Sorted by differential, best (most over quota) first. */
  players: QuotaPlayerView[];
}

function QuotaGameCard({
  roundId,
  tripId,
  game,
  isCaptain,
}: {
  roundId: string;
  tripId: string;
  game: QuotaGameView;
  isCaptain: boolean;
}) {
  return (
    <div className="space-y-3 rounded-lg bg-cream-100 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-charcoal-800">{game.name}</p>
          <p className="text-xs text-charcoal-500">Gross vs. par, against each golfer&apos;s own quota</p>
        </div>
        <div className="flex items-center gap-2">
          {game.isMonetary && <Badge variant="gold">{formatDollars(game.dollarValue)} ante</Badge>}
          {isCaptain && <DeleteGameButton roundId={roundId} tripId={tripId} gameId={game.id} gameName={game.name} />}
        </div>
      </div>

      {game.players.length === 0 ? (
        <p className="text-sm text-charcoal-400">No scores entered yet.</p>
      ) : (
        <ul className="space-y-1">
          {game.players.map((p) => (
            <li key={p.roundPlayerId} className="flex items-center justify-between text-sm text-charcoal-700">
              <span>
                {p.displayName} <span className="text-charcoal-400">(quota {p.target}, thru {p.holesCompleted})</span>
              </span>
              <span className={p.differential > 0 ? "font-medium text-emerald-700" : p.differential < 0 ? "font-medium text-red-700" : "text-charcoal-500"}>
                {p.points} pts ({p.differential > 0 ? "+" : ""}
                {p.differential})
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CreateQuotaForm({
  roundId,
  tripId,
  players,
  monetaryEnabled,
}: {
  roundId: string;
  tripId: string;
  players: PlayerOption[];
  monetaryEnabled: boolean;
}) {
  const action = createQuotaGameAction.bind(null, roundId, tripId);
  const [state, formAction] = useActionState(action, initialState);
  const [isMonetary, setIsMonetary] = useState(false);

  return (
    <form action={formAction} className="space-y-3 border-t border-charcoal-400/10 pt-4">
      <p className="text-xs font-medium text-charcoal-500">New quota game</p>

      <div>
        <Label htmlFor="quotaName">Name</Label>
        <Input id="quotaName" name="name" placeholder="Quota" required />
      </div>

      <div>
        <p className="text-xs font-medium text-charcoal-500">Golfers</p>
        <div className="mt-1 space-y-1">
          {players.map((p) => (
            <label key={p.roundPlayerId} className="flex items-center gap-2 text-sm text-charcoal-700">
              <input type="checkbox" name="playerIds" value={p.roundPlayerId} />
              {p.displayName}
            </label>
          ))}
        </div>
      </div>

      <MonetaryToggle monetaryEnabled={monetaryEnabled} isMonetary={isMonetary} onChange={setIsMonetary} />
      <MonetarySection show={monetaryEnabled && isMonetary} />

      {state.status === "error" && state.message && <Alert variant="error">{state.message}</Alert>}
      {state.status === "error" && state.fieldErrors && (
        <Alert variant="error">{Object.values(state.fieldErrors).flat().join(" ")}</Alert>
      )}

      <SubmitButton label="Create quota game" pendingLabel="Creating…" />
    </form>
  );
}

export function QuotaSection({
  tripId,
  roundId,
  isCaptain,
  players,
  games,
  monetaryEnabled,
}: {
  tripId: string;
  roundId: string;
  isCaptain: boolean;
  players: PlayerOption[];
  games: QuotaGameView[];
  monetaryEnabled: boolean;
}) {
  const canCreate = isCaptain && players.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quota</CardTitle>
        <CardDescription>Each golfer&apos;s target comes from their handicap — beat it or don&apos;t.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {games.length === 0 && <p className="text-sm text-charcoal-400">No quota games yet.</p>}
        {games.map((game) => (
          <QuotaGameCard key={game.id} roundId={roundId} tripId={tripId} game={game} isCaptain={isCaptain} />
        ))}
        {canCreate && (
          <CreateQuotaForm roundId={roundId} tripId={tripId} players={players} monetaryEnabled={monetaryEnabled} />
        )}
      </CardContent>
    </Card>
  );
}
