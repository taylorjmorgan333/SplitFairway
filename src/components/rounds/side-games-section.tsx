"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import {
  createNassauGameAction,
  createSkinsGameAction,
  addPressAction,
} from "@/actions/side-games";
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

export interface NassauSegmentView {
  segment: "front" | "back" | "overall";
  label: string;
  clinched: boolean;
}

export interface NassauPressView {
  id: string;
  label: string;
}

export interface NassauGameView {
  id: string;
  name: string;
  scoringMetric: "gross" | "net";
  isMonetary: boolean;
  dollarValue: number | null;
  side1Names: string[];
  side2Names: string[];
  /** Every participant's round_player_id (either side), used only to decide who can start a press. */
  participantIds: string[];
  segments: NassauSegmentView[];
  presses: NassauPressView[];
}

export interface SkinsHoleView {
  holeNumber: number;
  winnerName: string | null;
  skinsWon: number;
  carriedOver: boolean;
}

export interface SkinsStandingView {
  roundPlayerId: string;
  displayName: string;
  skinsWon: number;
}

export interface SkinsGameView {
  id: string;
  name: string;
  scoringMetric: "gross" | "net";
  isMonetary: boolean;
  dollarValue: number | null;
  carryover: boolean;
  standings: SkinsStandingView[];
  holes: SkinsHoleView[];
  pendingPot: number;
}

const SEGMENT_OPTIONS: { value: "front" | "back" | "overall"; label: string }[] = [
  { value: "overall", label: "Overall" },
  { value: "front", label: "Front 9" },
  { value: "back", label: "Back 9" },
];

function AddPressControl({ roundId, tripId, gameId }: { roundId: string; tripId: string; gameId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [segment, setSegment] = useState<"front" | "back" | "overall">("overall");
  const [startingHole, setStartingHole] = useState(1);

  return (
    <div className="flex flex-wrap items-end gap-2 border-t border-charcoal-400/10 pt-2">
      <div>
        <label className="text-xs font-medium text-charcoal-500">Press from hole</label>
        <input
          type="number"
          min={1}
          max={18}
          value={startingHole}
          onChange={(e) => setStartingHole(Number(e.target.value))}
          className="mt-1 h-9 w-20 rounded-lg border border-charcoal-400/25 bg-white px-2 text-sm focus:border-forest-600"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-charcoal-500">Segment</label>
        <select
          value={segment}
          onChange={(e) => setSegment(e.target.value as "front" | "back" | "overall")}
          className="mt-1 h-9 rounded-lg border border-charcoal-400/25 bg-white px-2 text-sm focus:border-forest-600"
        >
          {SEGMENT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await addPressAction(roundId, tripId, gameId, segment, startingHole);
            if (!result.ok) setError(result.error);
          });
        }}
        className="h-9 rounded-full border border-forest-800/20 px-3 text-xs font-medium text-forest-900 hover:bg-forest-50 disabled:opacity-50"
      >
        {isPending ? "Starting…" : "Start press"}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}

function NassauGameCard({
  roundId,
  tripId,
  game,
  isCaptain,
  myRoundPlayerId,
}: {
  roundId: string;
  tripId: string;
  game: NassauGameView;
  isCaptain: boolean;
  myRoundPlayerId: string | null;
}) {
  const canPress = isCaptain || (myRoundPlayerId != null && game.participantIds.includes(myRoundPlayerId));

  return (
    <div className="space-y-3 rounded-lg bg-cream-100 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-charcoal-800">{game.name}</p>
          <p className="text-xs text-charcoal-500">
            {game.side1Names.join(" & ") || "Side 1"} vs {game.side2Names.join(" & ") || "Side 2"}
            {" · "}
            {game.scoringMetric === "net" ? "Net" : "Gross"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {game.isMonetary && <Badge variant="gold">{formatDollars(game.dollarValue)}</Badge>}
          {isCaptain && <DeleteGameButton roundId={roundId} tripId={tripId} gameId={game.id} gameName={game.name} />}
        </div>
      </div>

      <ul className="space-y-1">
        {game.segments.map((seg) => (
          <li key={seg.segment} className="flex items-center gap-2 text-sm text-charcoal-700">
            <span>{seg.label}</span>
            {seg.clinched && <Badge variant="success">Final</Badge>}
          </li>
        ))}
      </ul>

      {game.presses.length > 0 && (
        <ul className="space-y-1 border-t border-charcoal-400/10 pt-2">
          {game.presses.map((press) => (
            <li key={press.id} className="text-sm text-charcoal-700">
              {press.label}
            </li>
          ))}
        </ul>
      )}

      {canPress && <AddPressControl roundId={roundId} tripId={tripId} gameId={game.id} />}
    </div>
  );
}

function SkinsGameCard({
  roundId,
  tripId,
  game,
  isCaptain,
}: {
  roundId: string;
  tripId: string;
  game: SkinsGameView;
  isCaptain: boolean;
}) {
  return (
    <div className="space-y-3 rounded-lg bg-cream-100 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-charcoal-800">{game.name}</p>
          <p className="text-xs text-charcoal-500">
            {game.scoringMetric === "net" ? "Net" : "Gross"}
            {game.carryover ? " · Carryover on" : " · No carryover"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {game.isMonetary && <Badge variant="gold">{formatDollars(game.dollarValue)} ante</Badge>}
          {isCaptain && <DeleteGameButton roundId={roundId} tripId={tripId} gameId={game.id} gameName={game.name} />}
        </div>
      </div>

      {game.standings.length === 0 ? (
        <p className="text-sm text-charcoal-400">No skins won yet.</p>
      ) : (
        <ul className="space-y-1">
          {game.standings.map((s) => (
            <li key={s.roundPlayerId} className="flex items-center justify-between text-sm text-charcoal-700">
              <span>{s.displayName}</span>
              <span>
                {s.skinsWon} skin{s.skinsWon === 1 ? "" : "s"}
              </span>
            </li>
          ))}
        </ul>
      )}

      {game.pendingPot > 1 && (
        <p className="text-xs text-charcoal-500">
          Next hole is worth {game.pendingPot} skins — {game.pendingPot - 1} carried over from tied holes.
        </p>
      )}

      {game.holes.length > 0 && (
        <details className="text-xs text-charcoal-500">
          <summary className="cursor-pointer select-none">Hole by hole</summary>
          <ul className="mt-2 space-y-1">
            {game.holes.map((h) => (
              <li key={h.holeNumber}>
                Hole {h.holeNumber}:{" "}
                {h.winnerName ? `${h.winnerName} (${h.skinsWon} skin${h.skinsWon === 1 ? "" : "s"})` : "Tied — carried over"}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

export function CreateNassauForm({
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
  const action = createNassauGameAction.bind(null, roundId, tripId);
  const [state, formAction] = useActionState(action, initialState);
  const [isMonetary, setIsMonetary] = useState(false);

  useEffect(() => {
    if (state.status === "success") onSuccess?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status]);

  return (
    <form action={formAction} className="space-y-3">
      <p className="text-xs font-medium text-charcoal-500">New Nassau game</p>

      <div>
        <Label htmlFor="nassauName">Name</Label>
        <Input id="nassauName" name="name" placeholder="Front/Back/Overall" required />
      </div>

      <div className="max-w-[10rem]">
        <Label htmlFor="nassauMetric">Scoring</Label>
        <select
          id="nassauMetric"
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
          <p className="text-xs font-medium text-charcoal-500">Side 1</p>
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
          <p className="text-xs font-medium text-charcoal-500">Side 2</p>
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
        <Alert variant="error">
          {Object.values(state.fieldErrors).flat().join(" ")}
        </Alert>
      )}

      <SubmitButton label="Create Nassau game" pendingLabel="Creating…" />
    </form>
  );
}

export function CreateSkinsForm({
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
  const action = createSkinsGameAction.bind(null, roundId, tripId);
  const [state, formAction] = useActionState(action, initialState);
  const [isMonetary, setIsMonetary] = useState(false);

  useEffect(() => {
    if (state.status === "success") onSuccess?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status]);

  return (
    <form action={formAction} className="space-y-3">
      <p className="text-xs font-medium text-charcoal-500">New skins game</p>

      <div>
        <Label htmlFor="skinsName">Name</Label>
        <Input id="skinsName" name="name" placeholder="Skins" required />
      </div>

      <div className="flex flex-wrap gap-4">
        <div className="max-w-[10rem]">
          <Label htmlFor="skinsMetric">Scoring</Label>
          <select
            id="skinsMetric"
            name="scoringMetric"
            defaultValue="net"
            className="mt-1 h-11 w-full rounded-lg border border-charcoal-400/25 bg-white px-3.5 text-sm text-charcoal focus:border-forest-600"
          >
            <option value="net">Net</option>
            <option value="gross">Gross</option>
          </select>
        </div>
        <label className="flex items-center gap-2 self-end pb-2.5 text-sm text-charcoal-700">
          <input type="checkbox" name="carryover" />
          Carry over ties
        </label>
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
      <MonetarySection show={monetaryEnabled && isMonetary} label="Value per skin" />
      {monetaryEnabled && isMonetary && (
        <p className="text-xs text-charcoal-500">
          Every golfer antes this amount into one pot; the pot splits across whoever won skins once the round
          ends, so the most anyone can lose is their own ante.
        </p>
      )}

      {state.status === "error" && state.message && <Alert variant="error">{state.message}</Alert>}
      {state.status === "error" && state.fieldErrors && (
        <Alert variant="error">
          {Object.values(state.fieldErrors).flat().join(" ")}
        </Alert>
      )}

      <SubmitButton label="Create skins game" pendingLabel="Creating…" />
    </form>
  );
}

export function SideGamesSection({
  tripId,
  roundId,
  isCaptain,
  myRoundPlayerId,
  nassauGames,
  skinsGames,
}: {
  tripId: string;
  roundId: string;
  isCaptain: boolean;
  myRoundPlayerId: string | null;
  players: PlayerOption[];
  nassauGames: NassauGameView[];
  skinsGames: SkinsGameView[];
  monetaryEnabled: boolean;
}) {
  if (nassauGames.length === 0 && skinsGames.length === 0) return null;

  return (
    <div className="space-y-6">
      {nassauGames.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Nassau</CardTitle>
            <CardDescription>Match play between two sides, with player-started presses.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {nassauGames.map((game) => (
              <NassauGameCard
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
      )}

      {skinsGames.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Skins</CardTitle>
            <CardDescription>Best score on a hole wins it outright — ties win nothing.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {skinsGames.map((game) => (
              <SkinsGameCard key={game.id} roundId={roundId} tripId={tripId} game={game} isCaptain={isCaptain} />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
