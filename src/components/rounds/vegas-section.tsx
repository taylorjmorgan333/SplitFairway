"use client";

import { useActionState, useState } from "react";
import { createVegasGameAction } from "@/actions/side-games";
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

export interface VegasHoleView {
  holeNumber: number;
  side1Number: number | null;
  side2Number: number | null;
  /** e.g. "Team 1 by 15", "Halved". */
  winnerLabel: string;
}

export interface VegasGameView {
  id: string;
  name: string;
  scoringMetric: "gross" | "net";
  isMonetary: boolean;
  dollarValue: number | null;
  side1Names: string[];
  side2Names: string[];
  holes: VegasHoleView[];
  /** e.g. "Team 1 up 12 pts thru 7", "All square thru 5", "Not started". */
  runningLabel: string;
}

function VegasGameCard({
  roundId,
  tripId,
  game,
  isCaptain,
}: {
  roundId: string;
  tripId: string;
  game: VegasGameView;
  isCaptain: boolean;
}) {
  return (
    <div className="space-y-3 rounded-lg bg-cream-100 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-charcoal-800">{game.name}</p>
          <p className="text-xs text-charcoal-500">
            {game.side1Names.join(" & ") || "Team 1"} vs {game.side2Names.join(" & ") || "Team 2"}
            {" · "}
            {game.scoringMetric === "net" ? "Net" : "Gross"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {game.isMonetary && <Badge variant="gold">{formatDollars(game.dollarValue)}/point</Badge>}
          {isCaptain && <DeleteGameButton roundId={roundId} tripId={tripId} gameId={game.id} gameName={game.name} />}
        </div>
      </div>

      <p className="text-sm text-charcoal-700">{game.runningLabel}</p>

      {game.holes.length > 0 && (
        <details className="text-xs text-charcoal-500">
          <summary className="cursor-pointer select-none">Hole by hole</summary>
          <ul className="mt-2 space-y-1">
            {game.holes.map((h) => (
              <li key={h.holeNumber}>
                Hole {h.holeNumber}: {h.side1Number ?? "–"} vs {h.side2Number ?? "–"} — {h.winnerLabel}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function CreateVegasForm({
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
  const action = createVegasGameAction.bind(null, roundId, tripId);
  const [state, formAction] = useActionState(action, initialState);
  const [isMonetary, setIsMonetary] = useState(false);

  return (
    <form action={formAction} className="space-y-3 border-t border-charcoal-400/10 pt-4">
      <p className="text-xs font-medium text-charcoal-500">New Vegas game</p>

      <div>
        <Label htmlFor="vegasName">Name</Label>
        <Input id="vegasName" name="name" placeholder="Vegas" required />
      </div>

      <div className="max-w-[10rem]">
        <Label htmlFor="vegasMetric">Scoring</Label>
        <select
          id="vegasMetric"
          name="scoringMetric"
          defaultValue="net"
          className="mt-1 h-11 w-full rounded-lg border border-charcoal-400/25 bg-white px-3.5 text-sm text-charcoal focus:border-forest-600"
        >
          <option value="net">Net</option>
          <option value="gross">Gross</option>
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs font-medium text-charcoal-500">Team 1 (exactly two)</p>
          <div className="mt-1 space-y-1">
            {players.map((p) => (
              <label key={p.roundPlayerId} className="flex items-center gap-2 text-sm text-charcoal-700">
                <input type="checkbox" name="side1PlayerIds" value={p.roundPlayerId} />
                {p.displayName}
              </label>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs font-medium text-charcoal-500">Team 2 (exactly two)</p>
          <div className="mt-1 space-y-1">
            {players.map((p) => (
              <label key={p.roundPlayerId} className="flex items-center gap-2 text-sm text-charcoal-700">
                <input type="checkbox" name="side2PlayerIds" value={p.roundPlayerId} />
                {p.displayName}
              </label>
            ))}
          </div>
        </div>
      </div>

      <MonetaryToggle monetaryEnabled={monetaryEnabled} isMonetary={isMonetary} onChange={setIsMonetary} />
      <MonetarySection show={monetaryEnabled && isMonetary} />

      {state.status === "error" && state.message && <Alert variant="error">{state.message}</Alert>}
      {state.status === "error" && state.fieldErrors && (
        <Alert variant="error">{Object.values(state.fieldErrors).flat().join(" ")}</Alert>
      )}

      <SubmitButton label="Create Vegas game" pendingLabel="Creating…" />
    </form>
  );
}

export function VegasSection({
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
  games: VegasGameView[];
  monetaryEnabled: boolean;
}) {
  const canCreate = isCaptain && players.length >= 4;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Vegas</CardTitle>
        <CardDescription>Two 2-player teams append their scores into one number — low number wins.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {games.length === 0 && <p className="text-sm text-charcoal-400">No Vegas games yet.</p>}
        {games.map((game) => (
          <VegasGameCard key={game.id} roundId={roundId} tripId={tripId} game={game} isCaptain={isCaptain} />
        ))}
        {canCreate && (
          <CreateVegasForm roundId={roundId} tripId={tripId} players={players} monetaryEnabled={monetaryEnabled} />
        )}
        {isCaptain && players.length > 0 && players.length < 4 && (
          <p className="text-xs text-charcoal-400">Vegas needs at least four golfers in this round.</p>
        )}
      </CardContent>
    </Card>
  );
}
