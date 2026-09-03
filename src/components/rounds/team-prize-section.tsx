"use client";

import { useActionState, useEffect, useState, type ReactNode } from "react";
import {
  createTeamAverageGameAction,
  createLowBallLowTotalGameAction,
  createLowHandicapHighHandicapGameAction,
  createLowBallHighBallGameAction,
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
  TwoSidedPlayerPicker,
  type PlayerOption,
} from "@/components/rounds/side-game-shared";
import type { ActionState } from "@/actions/auth";

/**
 * Four Batch 1 formats (Squabbit-list expansion) that are two-sided but
 * don't reduce to a single per-hole running total the way
 * team-stroke-section.tsx's six formats do -- each compares its two
 * sides on one or two round-level (not hole-by-hole) numbers instead:
 * Team Average (one number per side), Low Ball/Low Total and Low
 * Handicap/High Handicap (two independent round-level prizes each), and
 * Low Ball/High Ball (the one exception that IS scored hole by hole,
 * but as two independent point categories rather than one aggregate
 * score -- see team-formats.ts for all four's calc functions).
 */

export interface TeamAverageGameView {
  id: string;
  name: string;
  scoringMetric: "gross" | "net";
  isMonetary: boolean;
  dollarValue: number | null;
  side1Names: string[];
  side2Names: string[];
  side1Average: number | null;
  side2Average: number | null;
}

export interface LowBallLowTotalGameView {
  id: string;
  name: string;
  scoringMetric: "gross" | "net";
  isMonetary: boolean;
  dollarValue: number | null;
  side1Names: string[];
  side2Names: string[];
  lowBallWinnerSide: 1 | 2 | "halved" | null;
  side1BestIndividual: number | null;
  side2BestIndividual: number | null;
  lowTotalWinnerSide: 1 | 2 | "halved" | null;
  side1Total: number | null;
  side2Total: number | null;
}

export interface LowHighHandicapGameView {
  id: string;
  name: string;
  scoringMetric: "gross" | "net";
  isMonetary: boolean;
  dollarValue: number | null;
  side1Names: string[];
  side2Names: string[];
  lowHandicapWinnerSide: 1 | 2 | "halved" | null;
  side1LowHandicapTotal: number | null;
  side2LowHandicapTotal: number | null;
  highHandicapWinnerSide: 1 | 2 | "halved" | null;
  side1HighHandicapTotal: number | null;
  side2HighHandicapTotal: number | null;
}

export interface LowHighBallGameView {
  id: string;
  name: string;
  scoringMetric: "gross" | "net";
  isMonetary: boolean;
  dollarValue: number | null;
  side1Names: string[];
  side2Names: string[];
  side1Points: number;
  side2Points: number;
  holesPlayed: number;
}

function sideRow(label: string, winner: 1 | 2 | "halved" | null, side1Value: number | null, side2Value: number | null) {
  return (
    <div className="flex items-center justify-between text-sm text-charcoal-700">
      <span>{label}</span>
      <span>
        {side1Value ?? "–"} {winner === 1 && <Badge variant="success">Team 1</Badge>}
        {" vs "}
        {side2Value ?? "–"} {winner === 2 && <Badge variant="success">Team 2</Badge>}
        {winner === "halved" && <Badge variant="gold">Tied</Badge>}
      </span>
    </div>
  );
}

function CardShell({
  roundId,
  tripId,
  id,
  name,
  isMonetary,
  dollarValue,
  side1Names,
  side2Names,
  metricLabel,
  isCaptain,
  children,
}: {
  roundId: string;
  tripId: string;
  id: string;
  name: string;
  isMonetary: boolean;
  dollarValue: number | null;
  side1Names: string[];
  side2Names: string[];
  metricLabel: string;
  isCaptain: boolean;
  children: ReactNode;
}) {
  return (
    <div className="space-y-3 rounded-lg bg-cream-100 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-charcoal-800">{name}</p>
          <p className="text-xs text-charcoal-500">
            {side1Names.join(" & ") || "Team 1"} vs {side2Names.join(" & ") || "Team 2"} · {metricLabel}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isMonetary && <Badge variant="gold">{formatDollars(dollarValue)}</Badge>}
          {isCaptain && <DeleteGameButton roundId={roundId} tripId={tripId} gameId={id} gameName={name} />}
        </div>
      </div>
      {children}
    </div>
  );
}

function TeamAverageCard({ roundId, tripId, game, isCaptain }: { roundId: string; tripId: string; game: TeamAverageGameView; isCaptain: boolean }) {
  const winner =
    game.side1Average == null || game.side2Average == null
      ? null
      : game.side1Average < game.side2Average
        ? 1
        : game.side2Average < game.side1Average
          ? 2
          : "halved";
  return (
    <CardShell
      roundId={roundId}
      tripId={tripId}
      id={game.id}
      name={game.name}
      isMonetary={game.isMonetary}
      dollarValue={game.dollarValue}
      side1Names={game.side1Names}
      side2Names={game.side2Names}
      metricLabel={game.scoringMetric === "net" ? "Net" : "Gross"}
      isCaptain={isCaptain}
    >
      {sideRow(
        "Team average",
        winner,
        game.side1Average == null ? null : Math.round(game.side1Average * 10) / 10,
        game.side2Average == null ? null : Math.round(game.side2Average * 10) / 10,
      )}
    </CardShell>
  );
}

function LowBallLowTotalCard({ roundId, tripId, game, isCaptain }: { roundId: string; tripId: string; game: LowBallLowTotalGameView; isCaptain: boolean }) {
  return (
    <CardShell
      roundId={roundId}
      tripId={tripId}
      id={game.id}
      name={game.name}
      isMonetary={game.isMonetary}
      dollarValue={game.dollarValue}
      side1Names={game.side1Names}
      side2Names={game.side2Names}
      metricLabel={game.scoringMetric === "net" ? "Net" : "Gross"}
      isCaptain={isCaptain}
    >
      {sideRow("Low ball (best individual)", game.lowBallWinnerSide, game.side1BestIndividual, game.side2BestIndividual)}
      {sideRow("Low total (team combined)", game.lowTotalWinnerSide, game.side1Total, game.side2Total)}
    </CardShell>
  );
}

function LowHighHandicapCard({ roundId, tripId, game, isCaptain }: { roundId: string; tripId: string; game: LowHighHandicapGameView; isCaptain: boolean }) {
  return (
    <CardShell
      roundId={roundId}
      tripId={tripId}
      id={game.id}
      name={game.name}
      isMonetary={game.isMonetary}
      dollarValue={game.dollarValue}
      side1Names={game.side1Names}
      side2Names={game.side2Names}
      metricLabel={game.scoringMetric === "net" ? "Net" : "Gross"}
      isCaptain={isCaptain}
    >
      {sideRow("Low handicap pair", game.lowHandicapWinnerSide, game.side1LowHandicapTotal, game.side2LowHandicapTotal)}
      {sideRow("High handicap pair", game.highHandicapWinnerSide, game.side1HighHandicapTotal, game.side2HighHandicapTotal)}
    </CardShell>
  );
}

function LowHighBallCard({ roundId, tripId, game, isCaptain }: { roundId: string; tripId: string; game: LowHighBallGameView; isCaptain: boolean }) {
  return (
    <CardShell
      roundId={roundId}
      tripId={tripId}
      id={game.id}
      name={game.name}
      isMonetary={game.isMonetary}
      dollarValue={game.dollarValue}
      side1Names={game.side1Names}
      side2Names={game.side2Names}
      metricLabel={game.scoringMetric === "net" ? "Net" : "Gross"}
      isCaptain={isCaptain}
    >
      <p className="text-sm text-charcoal-700">
        {game.holesPlayed === 0
          ? "Not started"
          : `${game.side1Points} - ${game.side2Points} thru ${game.holesPlayed} (2 points up for grabs each hole)`}
      </p>
    </CardShell>
  );
}

type TwoSidedCreateAction = (
  roundId: string,
  tripId: string,
  prevState: ActionState,
  formData: FormData,
) => Promise<ActionState>;

function TeamPrizeCreateForm({
  action,
  roundId,
  tripId,
  players,
  monetaryEnabled,
  onSuccess,
  idPrefix,
  formTitle,
  namePlaceholder,
  submitLabel,
}: {
  action: TwoSidedCreateAction;
  roundId: string;
  tripId: string;
  players: PlayerOption[];
  monetaryEnabled: boolean;
  onSuccess?: () => void;
  idPrefix: string;
  formTitle: string;
  namePlaceholder: string;
  submitLabel: string;
}) {
  const boundAction = action.bind(null, roundId, tripId);
  const [state, formAction] = useActionState(boundAction, initialState);
  const [isMonetary, setIsMonetary] = useState(false);

  useEffect(() => {
    if (state.status === "success") onSuccess?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status]);

  return (
    <form action={formAction} className="space-y-3">
      <p className="text-xs font-medium text-charcoal-500">{formTitle}</p>

      <div>
        <Label htmlFor={`${idPrefix}Name`}>Name</Label>
        <Input id={`${idPrefix}Name`} name="name" placeholder={namePlaceholder} required />
      </div>

      <div className="max-w-[10rem]">
        <Label htmlFor={`${idPrefix}Metric`}>Scoring</Label>
        <select
          id={`${idPrefix}Metric`}
          name="scoringMetric"
          defaultValue="net"
          className="mt-1 h-11 w-full rounded-lg border border-charcoal-400/25 bg-white px-3.5 text-sm text-charcoal focus:border-forest-600"
        >
          <option value="net">Net</option>
          <option value="gross">Gross</option>
        </select>
      </div>

      <TwoSidedPlayerPicker players={players} side1Label="Team 1" side2Label="Team 2" />

      <MonetaryToggle monetaryEnabled={monetaryEnabled} isMonetary={isMonetary} onChange={setIsMonetary} />
      <MonetarySection show={monetaryEnabled && isMonetary} />

      {state.status === "error" && state.message && <Alert variant="error">{state.message}</Alert>}
      {state.status === "error" && state.fieldErrors && (
        <Alert variant="error">{Object.values(state.fieldErrors).flat().join(" ")}</Alert>
      )}

      <SubmitButton label={submitLabel} pendingLabel="Creating…" />
    </form>
  );
}

type FormProps = {
  roundId: string;
  tripId: string;
  players: PlayerOption[];
  monetaryEnabled: boolean;
  onSuccess?: () => void;
};

export function CreateTeamAverageForm(props: FormProps) {
  return (
    <TeamPrizeCreateForm
      {...props}
      action={createTeamAverageGameAction}
      idPrefix="teamAverage"
      formTitle="New team average game"
      namePlaceholder="Team Average"
      submitLabel="Create team average game"
    />
  );
}

export function CreateLowBallLowTotalForm(props: FormProps) {
  return (
    <TeamPrizeCreateForm
      {...props}
      action={createLowBallLowTotalGameAction}
      idPrefix="lowBallLowTotal"
      formTitle="New Low Ball Low Total game"
      namePlaceholder="Low Ball Low Total"
      submitLabel="Create Low Ball Low Total game"
    />
  );
}

export function CreateLowHandicapHighHandicapForm(props: FormProps) {
  return (
    <TeamPrizeCreateForm
      {...props}
      action={createLowHandicapHighHandicapGameAction}
      idPrefix="lowHighHandicap"
      formTitle="New Low Handicap High Handicap game"
      namePlaceholder="Low Handicap High Handicap"
      submitLabel="Create Low Handicap High Handicap game"
    />
  );
}

export function CreateLowBallHighBallForm(props: FormProps) {
  return (
    <TeamPrizeCreateForm
      {...props}
      action={createLowBallHighBallGameAction}
      idPrefix="lowHighBall"
      formTitle="New Low Ball High Ball game"
      namePlaceholder="Low Ball High Ball"
      submitLabel="Create Low Ball High Ball game"
    />
  );
}

export function TeamPrizeGamesSection({
  tripId,
  roundId,
  isCaptain,
  teamAverageGames,
  lowBallLowTotalGames,
  lowHighHandicapGames,
  lowHighBallGames,
}: {
  tripId: string;
  roundId: string;
  isCaptain: boolean;
  teamAverageGames: TeamAverageGameView[];
  lowBallLowTotalGames: LowBallLowTotalGameView[];
  lowHighHandicapGames: LowHighHandicapGameView[];
  lowHighBallGames: LowHighBallGameView[];
}) {
  if (
    teamAverageGames.length === 0 &&
    lowBallLowTotalGames.length === 0 &&
    lowHighHandicapGames.length === 0 &&
    lowHighBallGames.length === 0
  ) {
    return null;
  }

  return (
    <div className="space-y-6">
      {teamAverageGames.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Team Average</CardTitle>
            <CardDescription>Each team&apos;s score is the average of its own members&apos; totals.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {teamAverageGames.map((game) => (
              <TeamAverageCard key={game.id} roundId={roundId} tripId={tripId} game={game} isCaptain={isCaptain} />
            ))}
          </CardContent>
        </Card>
      )}

      {lowBallLowTotalGames.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Low Ball Low Total</CardTitle>
            <CardDescription>Two prizes: the single best individual score, and the lowest team total.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {lowBallLowTotalGames.map((game) => (
              <LowBallLowTotalCard key={game.id} roundId={roundId} tripId={tripId} game={game} isCaptain={isCaptain} />
            ))}
          </CardContent>
        </Card>
      )}

      {lowHighHandicapGames.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Low Handicap High Handicap</CardTitle>
            <CardDescription>Each team&apos;s lower-handicap golfers face off, and separately its higher-handicap golfers do.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {lowHighHandicapGames.map((game) => (
              <LowHighHandicapCard key={game.id} roundId={roundId} tripId={tripId} game={game} isCaptain={isCaptain} />
            ))}
          </CardContent>
        </Card>
      )}

      {lowHighBallGames.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Low Ball High Ball</CardTitle>
            <CardDescription>Two points a hole: one for the better score of each pair, one for the worse.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {lowHighBallGames.map((game) => (
              <LowHighBallCard key={game.id} roundId={roundId} tripId={tripId} game={game} isCaptain={isCaptain} />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
