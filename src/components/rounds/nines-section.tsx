"use client";

import { useActionState, useState } from "react";
import { createNinesGameAction } from "@/actions/side-games";
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

export interface NinesStandingView {
  roundPlayerId: string;
  displayName: string;
  /** Can be fractional -- ties split a hole's points. */
  points: number;
}

export interface NinesGameView {
  id: string;
  name: string;
  scoringMetric: "gross" | "net";
  isMonetary: boolean;
  /** Value per point above/below the field average, not a flat pot. */
  dollarValue: number | null;
  standings: NinesStandingView[];
  holesPlayed: number;
}

function formatPoints(points: number): string {
  return points.toLocaleString("en-US", { maximumFractionDigits: 1 });
}

function NinesGameCard({
  roundId,
  tripId,
  game,
  isCaptain,
}: {
  roundId: string;
  tripId: string;
  game: NinesGameView;
  isCaptain: boolean;
}) {
  return (
    <div className="space-y-3 rounded-lg bg-cream-100 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-charcoal-800">{game.name}</p>
          <p className="text-xs text-charcoal-500">
            9 points split every hole — 5 best, 3 middle, 1 worst
            {" · "}
            {game.scoringMetric === "net" ? "Net" : "Gross"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {game.isMonetary && <Badge variant="gold">{formatDollars(game.dollarValue)}/point</Badge>}
          {isCaptain && <DeleteGameButton roundId={roundId} tripId={tripId} gameId={game.id} gameName={game.name} />}
        </div>
      </div>

      {game.standings.length === 0 ? (
        <p className="text-sm text-charcoal-400">No points yet.</p>
      ) : (
        <ul className="space-y-1">
          {game.standings.map((s) => (
            <li key={s.roundPlayerId} className="flex items-center justify-between text-sm text-charcoal-700">
              <span>{s.displayName}</span>
              <span>{formatPoints(s.points)} pts</span>
            </li>
          ))}
        </ul>
      )}
      {game.holesPlayed > 0 && <p className="text-xs text-charcoal-400">Thru {game.holesPlayed}.</p>}
    </div>
  );
}

function CreateNinesForm({
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
  const action = createNinesGameAction.bind(null, roundId, tripId);
  const [state, formAction] = useActionState(action, initialState);
  const [isMonetary, setIsMonetary] = useState(false);

  return (
    <form action={formAction} className="space-y-3 border-t border-charcoal-400/10 pt-4">
      <p className="text-xs font-medium text-charcoal-500">New nines game</p>

      <div>
        <Label htmlFor="ninesName">Name</Label>
        <Input id="ninesName" name="name" placeholder="Nines" required />
      </div>

      <div className="max-w-[10rem]">
        <Label htmlFor="ninesMetric">Scoring</Label>
        <select
          id="ninesMetric"
          name="scoringMetric"
          defaultValue="net"
          className="mt-1 h-11 w-full rounded-lg border border-charcoal-400/25 bg-white px-3.5 text-sm text-charcoal focus:border-forest-600"
        >
          <option value="net">Net</option>
          <option value="gross">Gross</option>
        </select>
      </div>

      <div>
        <p className="text-xs font-medium text-charcoal-500">Golfers (exactly three)</p>
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

      <SubmitButton label="Create nines game" pendingLabel="Creating…" />
    </form>
  );
}

export function NinesSection({
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
  games: NinesGameView[];
  monetaryEnabled: boolean;
}) {
  const canCreate = isCaptain && players.length >= 3;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nines</CardTitle>
        <CardDescription>3-player points game, aka Hollywood — best score each hole earns the most.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {games.length === 0 && <p className="text-sm text-charcoal-400">No nines games yet.</p>}
        {games.map((game) => (
          <NinesGameCard key={game.id} roundId={roundId} tripId={tripId} game={game} isCaptain={isCaptain} />
        ))}
        {canCreate && (
          <CreateNinesForm roundId={roundId} tripId={tripId} players={players} monetaryEnabled={monetaryEnabled} />
        )}
        {isCaptain && players.length > 0 && players.length < 3 && (
          <p className="text-xs text-charcoal-400">Nines needs exactly three golfers.</p>
        )}
      </CardContent>
    </Card>
  );
}
