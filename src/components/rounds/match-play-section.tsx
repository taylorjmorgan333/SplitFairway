"use client";

import { useActionState, useEffect, useState } from "react";
import { createMatchPlayGameAction } from "@/actions/side-games";
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
  TwoSidedPlayerPicker,
  type PlayerOption,
} from "@/components/rounds/side-game-shared";

/**
 * Match Play (Batch 1 of the Squabbit-list expansion): a single golfer
 * vs. a single golfer, "win holes, not strokes" over the whole round --
 * unlike Nassau, no front/back split and no presses, since that's what
 * differentiates the two in real play (Nassau is three bets, match play
 * is one). Scored by literally reusing nassau.ts#computeMatchStatus over
 * just the "overall" segment with one player per side, since that's
 * exactly what a plain head-to-head match already computes.
 */

export interface MatchPlayGameView {
  id: string;
  name: string;
  scoringMetric: "gross" | "net";
  isMonetary: boolean;
  dollarValue: number | null;
  side1Name: string;
  side2Name: string;
  label: string;
  clinched: boolean;
}

function MatchPlayGameCard({
  roundId,
  tripId,
  game,
  isCaptain,
}: {
  roundId: string;
  tripId: string;
  game: MatchPlayGameView;
  isCaptain: boolean;
}) {
  return (
    <div className="space-y-3 rounded-lg bg-cream-100 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-charcoal-800">{game.name}</p>
          <p className="text-xs text-charcoal-500">
            {game.side1Name} vs {game.side2Name}
            {" · "}
            {game.scoringMetric === "net" ? "Net" : "Gross"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {game.isMonetary && <Badge variant="gold">{formatDollars(game.dollarValue)}</Badge>}
          {isCaptain && <DeleteGameButton roundId={roundId} tripId={tripId} gameId={game.id} gameName={game.name} />}
        </div>
      </div>
      <p className="flex items-center gap-2 text-sm text-charcoal-700">
        {game.label}
        {game.clinched && <Badge variant="success">Final</Badge>}
      </p>
    </div>
  );
}

export function CreateMatchPlayForm({
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
  const action = createMatchPlayGameAction.bind(null, roundId, tripId);
  const [state, formAction] = useActionState(action, initialState);
  const [isMonetary, setIsMonetary] = useState(false);

  useEffect(() => {
    if (state.status === "success") onSuccess?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status]);

  return (
    <form action={formAction} className="space-y-3">
      <p className="text-xs font-medium text-charcoal-500">New match play game</p>

      <div>
        <Label htmlFor="matchPlayName">Name</Label>
        <Input id="matchPlayName" name="name" placeholder="Match Play" required />
      </div>

      <div className="max-w-[10rem]">
        <Label htmlFor="matchPlayMetric">Scoring</Label>
        <select
          id="matchPlayMetric"
          name="scoringMetric"
          defaultValue="net"
          className="mt-1 h-11 w-full rounded-lg border border-charcoal-400/25 bg-white px-3.5 text-sm text-charcoal focus:border-forest-600"
        >
          <option value="net">Net</option>
          <option value="gross">Gross</option>
        </select>
      </div>

      <TwoSidedPlayerPicker
        players={players}
        side1Label="Golfer 1"
        side2Label="Golfer 2"
        side1Mode="select"
        side2Mode="select"
      />

      <MonetaryToggle monetaryEnabled={monetaryEnabled} isMonetary={isMonetary} onChange={setIsMonetary} />
      <MonetarySection show={monetaryEnabled && isMonetary} />

      {state.status === "error" && state.message && <Alert variant="error">{state.message}</Alert>}
      {state.status === "error" && state.fieldErrors && (
        <Alert variant="error">{Object.values(state.fieldErrors).flat().join(" ")}</Alert>
      )}

      <SubmitButton label="Create match play game" pendingLabel="Creating…" />
    </form>
  );
}

export function MatchPlaySection({
  tripId,
  roundId,
  isCaptain,
  games,
}: {
  tripId: string;
  roundId: string;
  isCaptain: boolean;
  games: MatchPlayGameView[];
}) {
  if (games.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Match Play</CardTitle>
        <CardDescription>Two golfers, head to head -- win holes, not strokes.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {games.map((game) => (
          <MatchPlayGameCard key={game.id} roundId={roundId} tripId={tripId} game={game} isCaptain={isCaptain} />
        ))}
      </CardContent>
    </Card>
  );
}
