"use client";

import { useActionState, useEffect, useState } from "react";
import {
  createBestBallGameAction,
  createWorstBallGameAction,
  createShambleGameAction,
  createLoneRangerGameAction,
  createChaChaChaGameAction,
  createOneGrossOneNetGameAction,
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
 * Six Batch 1 formats (Squabbit-list expansion) that all share the same
 * output shape -- team-formats.ts#computeTeamStrokeFormat /
 * #computeOneGrossOneNet: two sides, a per-hole aggregate score each,
 * cumulative totals over the holes played, lower total wins. Best Ball,
 * Worst Ball, and Shamble are literally the identical formula (best-ball
 * min, worst-ball max, and Shamble scores the same as best ball --
 * see team-formats.ts's own doc comment); Lone Ranger is best-ball with
 * side 1 forced to exactly one golfer; Cha Cha Cha uses a formula whose
 * selected-count rotates by hole; One Gross One Net combines a gross-best
 * and a net-best per hole instead of picking one metric. Only the
 * display copy, participant-picker shape, and bound action differ, so
 * one shared card + form body covers all six.
 */

export interface TeamStrokeHoleView {
  holeNumber: number;
  side1Score: number;
  side2Score: number;
}

export interface TeamStrokeGameView {
  id: string;
  name: string;
  isMonetary: boolean;
  dollarValue: number | null;
  side1Names: string[];
  side2Names: string[];
  holes: TeamStrokeHoleView[];
  side1Total: number;
  side2Total: number;
  /** "Gross" / "Net" for formats with a real choice, null for One Gross One Net (which always uses both). */
  metricLabel: string | null;
}

function TeamStrokeCard({
  roundId,
  tripId,
  game,
  isCaptain,
  side1Fallback,
  side2Fallback,
}: {
  roundId: string;
  tripId: string;
  game: TeamStrokeGameView;
  isCaptain: boolean;
  side1Fallback: string;
  side2Fallback: string;
}) {
  const diff = game.side1Total - game.side2Total;
  const holesPlayed = game.holes.length;

  return (
    <div className="space-y-3 rounded-lg bg-cream-100 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-charcoal-800">{game.name}</p>
          <p className="text-xs text-charcoal-500">
            {game.side1Names.join(" & ") || side1Fallback} vs {game.side2Names.join(" & ") || side2Fallback}
            {game.metricLabel && <> · {game.metricLabel}</>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {game.isMonetary && <Badge variant="gold">{formatDollars(game.dollarValue)}</Badge>}
          {isCaptain && <DeleteGameButton roundId={roundId} tripId={tripId} gameId={game.id} gameName={game.name} />}
        </div>
      </div>

      <p className="text-sm text-charcoal-700">
        {holesPlayed === 0
          ? "Not started"
          : diff === 0
            ? `All square thru ${holesPlayed} (${game.side1Total}-${game.side2Total})`
            : `Side ${diff < 0 ? 1 : 2} leads by ${Math.abs(diff)} thru ${holesPlayed} (${game.side1Total}-${game.side2Total})`}
      </p>

      {game.holes.length > 0 && (
        <details className="text-xs text-charcoal-500">
          <summary className="cursor-pointer select-none">Hole by hole</summary>
          <ul className="mt-2 space-y-1">
            {game.holes.map((h) => (
              <li key={h.holeNumber}>
                Hole {h.holeNumber}: {h.side1Score} - {h.side2Score}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

type TwoSidedCreateAction = (
  roundId: string,
  tripId: string,
  prevState: ActionState,
  formData: FormData,
) => Promise<ActionState>;

function TeamStrokeCreateForm({
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
  side1Label,
  side2Label,
  side1Mode = "checkbox",
  showMetric = true,
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
  side1Label: string;
  side2Label: string;
  side1Mode?: "checkbox" | "select";
  showMetric?: boolean;
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

      {showMetric && (
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
      )}

      <TwoSidedPlayerPicker players={players} side1Label={side1Label} side2Label={side2Label} side1Mode={side1Mode} />

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

export function CreateBestBallForm(props: FormProps) {
  return (
    <TeamStrokeCreateForm
      {...props}
      action={createBestBallGameAction}
      idPrefix="bestBall"
      formTitle="New best ball game"
      namePlaceholder="Best Ball"
      submitLabel="Create best ball game"
      side1Label="Team 1"
      side2Label="Team 2"
    />
  );
}

export function CreateWorstBallForm(props: FormProps) {
  return (
    <TeamStrokeCreateForm
      {...props}
      action={createWorstBallGameAction}
      idPrefix="worstBall"
      formTitle="New worst ball game"
      namePlaceholder="Worst Ball"
      submitLabel="Create worst ball game"
      side1Label="Team 1"
      side2Label="Team 2"
    />
  );
}

export function CreateShambleForm(props: FormProps) {
  return (
    <TeamStrokeCreateForm
      {...props}
      action={createShambleGameAction}
      idPrefix="shamble"
      formTitle="New shamble game"
      namePlaceholder="Shamble"
      submitLabel="Create shamble game"
      side1Label="Team 1"
      side2Label="Team 2"
    />
  );
}

export function CreateLoneRangerForm(props: FormProps) {
  return (
    <TeamStrokeCreateForm
      {...props}
      action={createLoneRangerGameAction}
      idPrefix="loneRanger"
      formTitle="New Lone Ranger game"
      namePlaceholder="Lone Ranger"
      submitLabel="Create Lone Ranger game"
      side1Label="Lone Ranger"
      side2Label="The rest of the group"
      side1Mode="select"
    />
  );
}

export function CreateChaChaChaForm(props: FormProps) {
  return (
    <TeamStrokeCreateForm
      {...props}
      action={createChaChaChaGameAction}
      idPrefix="chaChaCha"
      formTitle="New Cha Cha Cha game"
      namePlaceholder="Cha Cha Cha"
      submitLabel="Create Cha Cha Cha game"
      side1Label="Team 1"
      side2Label="Team 2"
    />
  );
}

export function CreateOneGrossOneNetForm(props: FormProps) {
  return (
    <TeamStrokeCreateForm
      {...props}
      action={createOneGrossOneNetGameAction}
      idPrefix="oneGrossOneNet"
      formTitle="New One Gross One Net game"
      namePlaceholder="One Gross One Net"
      submitLabel="Create One Gross One Net game"
      side1Label="Team 1"
      side2Label="Team 2"
      showMetric={false}
    />
  );
}

export function TeamStrokeGamesSection({
  tripId,
  roundId,
  isCaptain,
  bestBallGames,
  worstBallGames,
  shambleGames,
  loneRangerGames,
  chaChaChaGames,
  oneGrossOneNetGames,
}: {
  tripId: string;
  roundId: string;
  isCaptain: boolean;
  bestBallGames: TeamStrokeGameView[];
  worstBallGames: TeamStrokeGameView[];
  shambleGames: TeamStrokeGameView[];
  loneRangerGames: TeamStrokeGameView[];
  chaChaChaGames: TeamStrokeGameView[];
  oneGrossOneNetGames: TeamStrokeGameView[];
}) {
  const groups: { key: string; title: string; description: string; games: TeamStrokeGameView[]; side1: string; side2: string }[] = [
    { key: "best_ball", title: "Best Ball", description: "Each team's best individual score on a hole counts.", games: bestBallGames, side1: "Team 1", side2: "Team 2" },
    { key: "worst_ball", title: "Worst Ball", description: "Each team's worst individual score on a hole counts.", games: worstBallGames, side1: "Team 1", side2: "Team 2" },
    { key: "shamble", title: "Shamble", description: "Everyone tees off together; best individual score from there counts.", games: shambleGames, side1: "Team 1", side2: "Team 2" },
    { key: "lone_ranger", title: "Lone Ranger", description: "One golfer's own score vs. the best ball of everyone else.", games: loneRangerGames, side1: "Lone Ranger", side2: "The rest" },
    { key: "cha_cha_cha", title: "Cha Cha Cha", description: "How many scores count rotates hole by hole.", games: chaChaChaGames, side1: "Team 1", side2: "Team 2" },
    { key: "one_gross_one_net", title: "One Gross One Net", description: "Each team's best gross plus best net on a hole counts.", games: oneGrossOneNetGames, side1: "Team 1", side2: "Team 2" },
  ];

  if (groups.every((g) => g.games.length === 0)) return null;

  return (
    <div className="space-y-6">
      {groups.map(
        (g) =>
          g.games.length > 0 && (
            <Card key={g.key}>
              <CardHeader>
                <CardTitle>{g.title}</CardTitle>
                <CardDescription>{g.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {g.games.map((game) => (
                  <TeamStrokeCard
                    key={game.id}
                    roundId={roundId}
                    tripId={tripId}
                    game={game}
                    isCaptain={isCaptain}
                    side1Fallback={g.side1}
                    side2Fallback={g.side2}
                  />
                ))}
              </CardContent>
            </Card>
          ),
      )}
    </div>
  );
}
