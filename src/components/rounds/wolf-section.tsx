"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { createWolfGameAction, setWolfPickAction } from "@/actions/side-games";
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

export interface WolfHoleView {
  holeNumber: number;
  wolfRoundPlayerId: string | null;
  wolfName: string | null;
  partnerName: string | null;
  isLoneWolf: boolean;
  /** e.g. "Not decided yet", "Halved", "Bob & Amy win", "Steve wins (lone wolf)". */
  outcomeLabel: string;
  decided: boolean;
}

export interface WolfGameView {
  id: string;
  name: string;
  scoringMetric: "gross" | "net";
  isMonetary: boolean;
  dollarValue: number | null;
  /** Exactly 4, in hitting order. */
  order: PlayerOption[];
  holes: WolfHoleView[];
}

function WolfPickControl({
  roundId,
  tripId,
  gameId,
  holeNumber,
  wolfName,
  partnerOptions,
}: {
  roundId: string;
  tripId: string;
  gameId: string;
  holeNumber: number;
  wolfName: string;
  partnerOptions: PlayerOption[];
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selection, setSelection] = useState<string>(partnerOptions[0]?.roundPlayerId ?? "lone");

  return (
    <div className="space-y-2 rounded-lg bg-white p-3">
      <p className="text-sm font-medium text-charcoal-800">
        Hole {holeNumber}: {wolfName} is the wolf
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={selection}
          onChange={(e) => setSelection(e.target.value)}
          className="h-9 rounded-lg border border-charcoal-400/25 bg-white px-2 text-sm focus:border-forest-600"
        >
          {partnerOptions.map((p) => (
            <option key={p.roundPlayerId} value={p.roundPlayerId}>
              Partner: {p.displayName}
            </option>
          ))}
          <option value="lone">Go lone wolf</option>
        </select>
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const isLoneWolf = selection === "lone";
              const result = await setWolfPickAction(
                roundId,
                tripId,
                gameId,
                holeNumber,
                isLoneWolf ? null : selection,
                isLoneWolf,
              );
              if (!result.ok) setError(result.error);
            });
          }}
          className="h-9 rounded-full border border-forest-800/20 px-3 text-xs font-medium text-forest-900 hover:bg-forest-50 disabled:opacity-50"
        >
          {isPending ? "Saving…" : "Save pick"}
        </button>
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    </div>
  );
}

function WolfGameCard({
  roundId,
  tripId,
  game,
  isCaptain,
  myRoundPlayerId,
}: {
  roundId: string;
  tripId: string;
  game: WolfGameView;
  isCaptain: boolean;
  myRoundPlayerId: string | null;
}) {
  const participantIds = game.order.map((o) => o.roundPlayerId);
  const canPick = isCaptain || (myRoundPlayerId != null && participantIds.includes(myRoundPlayerId));
  const nextUndecided = game.holes.find((h) => !h.decided && h.wolfRoundPlayerId);

  return (
    <div className="space-y-3 rounded-lg bg-cream-100 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-charcoal-800">{game.name}</p>
          <p className="text-xs text-charcoal-500">
            {game.order.map((o) => o.displayName).join(" → ")}
            {" · "}
            {game.scoringMetric === "net" ? "Net" : "Gross"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {game.isMonetary && <Badge variant="gold">{formatDollars(game.dollarValue)}/hole</Badge>}
          {isCaptain && <DeleteGameButton roundId={roundId} tripId={tripId} gameId={game.id} gameName={game.name} />}
        </div>
      </div>

      {canPick && nextUndecided && nextUndecided.wolfRoundPlayerId && nextUndecided.wolfName && (
        <WolfPickControl
          roundId={roundId}
          tripId={tripId}
          gameId={game.id}
          holeNumber={nextUndecided.holeNumber}
          wolfName={nextUndecided.wolfName}
          partnerOptions={game.order.filter((o) => o.roundPlayerId !== nextUndecided.wolfRoundPlayerId)}
        />
      )}

      {game.holes.length > 0 && (
        <details className="text-xs text-charcoal-500">
          <summary className="cursor-pointer select-none">All holes</summary>
          <ul className="mt-2 space-y-1">
            {game.holes.map((h) => (
              <li key={h.holeNumber}>
                Hole {h.holeNumber}: {h.wolfName ?? "?"} — {h.outcomeLabel}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

export function CreateWolfForm({
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
  const action = createWolfGameAction.bind(null, roundId, tripId);
  const [state, formAction] = useActionState(action, initialState);
  const [isMonetary, setIsMonetary] = useState(false);

  useEffect(() => {
    if (state.status === "success") onSuccess?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status]);

  return (
    <form action={formAction} className="space-y-3">
      <p className="text-xs font-medium text-charcoal-500">New wolf game</p>

      <div>
        <Label htmlFor="wolfName">Name</Label>
        <Input id="wolfName" name="name" placeholder="Wolf" required />
      </div>

      <div className="max-w-[10rem]">
        <Label htmlFor="wolfMetric">Scoring</Label>
        <select
          id="wolfMetric"
          name="scoringMetric"
          defaultValue="net"
          className="mt-1 h-11 w-full rounded-lg border border-charcoal-400/25 bg-white px-3.5 text-sm text-charcoal focus:border-forest-600"
        >
          <option value="net">Net</option>
          <option value="gross">Gross</option>
        </select>
      </div>

      <div>
        <p className="text-xs font-medium text-charcoal-500">Hitting order (who&apos;s wolf first)</p>
        <div className="mt-1 space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <select
              key={i}
              name="playerIds"
              required
              defaultValue=""
              className="h-11 w-full rounded-lg border border-charcoal-400/25 bg-white px-3.5 text-sm text-charcoal focus:border-forest-600"
            >
              <option value="" disabled>
                {`Golfer ${i + 1}`}
              </option>
              {players.map((p) => (
                <option key={p.roundPlayerId} value={p.roundPlayerId}>
                  {p.displayName}
                </option>
              ))}
            </select>
          ))}
        </div>
      </div>

      <MonetaryToggle monetaryEnabled={monetaryEnabled} isMonetary={isMonetary} onChange={setIsMonetary} />
      <MonetarySection show={monetaryEnabled && isMonetary} />

      {state.status === "error" && state.message && <Alert variant="error">{state.message}</Alert>}
      {state.status === "error" && state.fieldErrors && (
        <Alert variant="error">{Object.values(state.fieldErrors).flat().join(" ")}</Alert>
      )}

      <SubmitButton label="Create wolf game" pendingLabel="Creating…" />
    </form>
  );
}

export function WolfSection({
  tripId,
  roundId,
  isCaptain,
  myRoundPlayerId,
  games,
}: {
  tripId: string;
  roundId: string;
  isCaptain: boolean;
  myRoundPlayerId: string | null;
  players: PlayerOption[];
  games: WolfGameView[];
  monetaryEnabled: boolean;
}) {
  if (games.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Wolf</CardTitle>
        <CardDescription>4 players, rotating captain each hole — pick a partner or go it alone.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {games.map((game) => (
          <WolfGameCard
            key={game.id}
            roundId={roundId}
            tripId={tripId}
            game={game}
            isCaptain={isCaptain}
            myRoundPlayerId={myRoundPlayerId}
          />
        ))}
      </CardContent>
    </Card>
  );
}
