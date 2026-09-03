"use client";

import { useActionState, useEffect, useState } from "react";
import { createStrokePlayGameAction, createStablefordGameAction } from "@/actions/side-games";
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

/**
 * Stroke Play and Stableford (Batch 1 of the Squabbit-list expansion):
 * both are field-wide leaderboards, not two-sided formats, so both
 * reuse scoring.ts#computeStandings directly rather than needing a new
 * calc module -- stroke play ranks ascending on gross/net total,
 * Stableford ranks descending on points (already what computeStandings
 * does for its "stableford" metric). Sharing one file since the two
 * only differ in ranking direction and the value's unit label.
 */

export interface LeaderboardStandingView {
  roundPlayerId: string;
  displayName: string;
  rank: number;
  value: number;
  thru: number;
}

export interface StrokePlayGameView {
  id: string;
  name: string;
  scoringMetric: "gross" | "net";
  isMonetary: boolean;
  dollarValue: number | null;
  standings: LeaderboardStandingView[];
}

export interface StablefordGameView {
  id: string;
  name: string;
  isMonetary: boolean;
  dollarValue: number | null;
  standings: LeaderboardStandingView[];
}

function LeaderboardCard({
  roundId,
  tripId,
  id,
  name,
  isMonetary,
  dollarValue,
  metricLabel,
  standings,
  valueSuffix,
  isCaptain,
}: {
  roundId: string;
  tripId: string;
  id: string;
  name: string;
  isMonetary: boolean;
  dollarValue: number | null;
  metricLabel: string;
  standings: LeaderboardStandingView[];
  valueSuffix: string;
  isCaptain: boolean;
}) {
  return (
    <div className="space-y-3 rounded-lg bg-cream-100 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-charcoal-800">{name}</p>
          <p className="text-xs text-charcoal-500">{metricLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          {isMonetary && <Badge variant="gold">{formatDollars(dollarValue)}</Badge>}
          {isCaptain && <DeleteGameButton roundId={roundId} tripId={tripId} gameId={id} gameName={name} />}
        </div>
      </div>

      {standings.length === 0 ? (
        <p className="text-sm text-charcoal-400">No scores entered yet.</p>
      ) : (
        <ul className="space-y-1">
          {standings.map((s) => (
            <li key={s.roundPlayerId} className="flex items-center justify-between text-sm text-charcoal-700">
              <span>
                {s.rank}. {s.displayName} <span className="text-charcoal-400">(thru {s.thru})</span>
              </span>
              <span>
                {s.value} {valueSuffix}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function CreateStrokePlayForm({
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
  const action = createStrokePlayGameAction.bind(null, roundId, tripId);
  const [state, formAction] = useActionState(action, initialState);
  const [isMonetary, setIsMonetary] = useState(false);

  useEffect(() => {
    if (state.status === "success") onSuccess?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status]);

  return (
    <form action={formAction} className="space-y-3">
      <p className="text-xs font-medium text-charcoal-500">New stroke play game</p>

      <div>
        <Label htmlFor="strokePlayName">Name</Label>
        <Input id="strokePlayName" name="name" placeholder="Stroke Play" required />
      </div>

      <div className="max-w-[10rem]">
        <Label htmlFor="strokePlayMetric">Scoring</Label>
        <select
          id="strokePlayMetric"
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

      <SubmitButton label="Create stroke play game" pendingLabel="Creating…" />
    </form>
  );
}

/** No scoring-metric select -- Stableford is always net, same reasoning quota's create form uses. */
export function CreateStablefordForm({
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
  const action = createStablefordGameAction.bind(null, roundId, tripId);
  const [state, formAction] = useActionState(action, initialState);
  const [isMonetary, setIsMonetary] = useState(false);

  useEffect(() => {
    if (state.status === "success") onSuccess?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status]);

  return (
    <form action={formAction} className="space-y-3">
      <p className="text-xs font-medium text-charcoal-500">New Stableford game</p>

      <div>
        <Label htmlFor="stablefordName">Name</Label>
        <Input id="stablefordName" name="name" placeholder="Stableford" required />
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

      <SubmitButton label="Create Stableford game" pendingLabel="Creating…" />
    </form>
  );
}

export function StrokePlaySection({
  tripId,
  roundId,
  isCaptain,
  strokePlayGames,
  stablefordGames,
}: {
  tripId: string;
  roundId: string;
  isCaptain: boolean;
  strokePlayGames: StrokePlayGameView[];
  stablefordGames: StablefordGameView[];
}) {
  if (strokePlayGames.length === 0 && stablefordGames.length === 0) return null;

  return (
    <div className="space-y-6">
      {strokePlayGames.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Stroke Play</CardTitle>
            <CardDescription>Every stroke counts over the round -- lowest total wins.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {strokePlayGames.map((game) => (
              <LeaderboardCard
                key={game.id}
                roundId={roundId}
                tripId={tripId}
                id={game.id}
                name={game.name}
                isMonetary={game.isMonetary}
                dollarValue={game.dollarValue}
                metricLabel={game.scoringMetric === "net" ? "Net" : "Gross"}
                standings={game.standings}
                valueSuffix="strokes"
                isCaptain={isCaptain}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {stablefordGames.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Stableford</CardTitle>
            <CardDescription>Points for your score relative to par on each hole -- most points wins.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {stablefordGames.map((game) => (
              <LeaderboardCard
                key={game.id}
                roundId={roundId}
                tripId={tripId}
                id={game.id}
                name={game.name}
                isMonetary={game.isMonetary}
                dollarValue={game.dollarValue}
                metricLabel="Net"
                standings={game.standings}
                valueSuffix="pts"
                isCaptain={isCaptain}
              />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
