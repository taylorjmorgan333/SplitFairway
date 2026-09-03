"use client";

import { useActionState, useEffect, useState } from "react";
import { createTwosGameAction } from "@/actions/side-games";
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

export interface TwosHoleView {
  holeNumber: number;
  winnerNames: string[];
}

export interface TwosStandingView {
  roundPlayerId: string;
  displayName: string;
  twosMade: number;
}

export interface TwosGameView {
  id: string;
  name: string;
  scoringMetric: "gross" | "net";
  isMonetary: boolean;
  dollarValue: number | null;
  standings: TwosStandingView[];
  holes: TwosHoleView[];
}

function TwosGameCard({
  roundId,
  tripId,
  game,
  isCaptain,
}: {
  roundId: string;
  tripId: string;
  game: TwosGameView;
  isCaptain: boolean;
}) {
  return (
    <div className="space-y-3 rounded-lg bg-cream-100 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-charcoal-800">{game.name}</p>
          <p className="text-xs text-charcoal-500">
            Make a 2 and you&apos;re in the club — each hole&apos;s its own payout, no carryover
            {" · "}
            {game.scoringMetric === "net" ? "Net" : "Gross"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {game.isMonetary && <Badge variant="gold">{formatDollars(game.dollarValue)}/two</Badge>}
          {isCaptain && <DeleteGameButton roundId={roundId} tripId={tripId} gameId={game.id} gameName={game.name} />}
        </div>
      </div>

      {game.standings.every((s) => s.twosMade === 0) ? (
        <p className="text-sm text-charcoal-400">No 2s yet.</p>
      ) : (
        <ul className="space-y-1">
          {game.standings
            .filter((s) => s.twosMade > 0)
            .map((s) => (
              <li key={s.roundPlayerId} className="flex items-center justify-between text-sm text-charcoal-700">
                <span>{s.displayName}</span>
                <span>
                  {s.twosMade} two{s.twosMade === 1 ? "" : "s"}
                </span>
              </li>
            ))}
        </ul>
      )}

      {game.holes.length > 0 && (
        <details className="text-xs text-charcoal-500">
          <summary className="cursor-pointer select-none">Hole by hole</summary>
          <ul className="mt-2 space-y-1">
            {game.holes.map((h) => (
              <li key={h.holeNumber}>
                Hole {h.holeNumber}: {h.winnerNames.length > 0 ? h.winnerNames.join(" & ") : "No 2s"}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

export function CreateTwosForm({
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
  const action = createTwosGameAction.bind(null, roundId, tripId);
  const [state, formAction] = useActionState(action, initialState);
  const [isMonetary, setIsMonetary] = useState(false);

  useEffect(() => {
    if (state.status === "success") onSuccess?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status]);

  return (
    <form action={formAction} className="space-y-3">
      <p className="text-xs font-medium text-charcoal-500">New twos club game</p>

      <div>
        <Label htmlFor="twosName">Name</Label>
        <Input id="twosName" name="name" placeholder="Twos Club" required />
      </div>

      <div className="max-w-[10rem]">
        <Label htmlFor="twosMetric">Scoring</Label>
        <select
          id="twosMetric"
          name="scoringMetric"
          defaultValue="net"
          className="mt-1 h-11 w-full rounded-lg border border-charcoal-400/25 bg-white px-3.5 text-sm text-charcoal focus:border-forest-600"
        >
          <option value="net">Net</option>
          <option value="gross">Gross</option>
        </select>
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

      <SubmitButton label="Create twos club game" pendingLabel="Creating…" />
    </form>
  );
}

export function TwosSection({
  tripId,
  roundId,
  isCaptain,
  games,
}: {
  tripId: string;
  roundId: string;
  isCaptain: boolean;
  players: PlayerOption[];
  games: TwosGameView[];
  monetaryEnabled: boolean;
}) {
  if (games.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Twos Club</CardTitle>
        <CardDescription>Make a 2 on any hole and split that hole&apos;s pot with anyone else who did.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {games.map((game) => (
          <TwosGameCard key={game.id} roundId={roundId} tripId={tripId} game={game} isCaptain={isCaptain} />
        ))}
      </CardContent>
    </Card>
  );
}
