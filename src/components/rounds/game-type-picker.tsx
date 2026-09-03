"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import type { PlayerOption } from "@/components/rounds/side-game-shared";
import { CreateNassauForm, CreateSkinsForm } from "@/components/rounds/side-games-section";
import { CreateWolfForm } from "@/components/rounds/wolf-section";
import { CreateVegasForm } from "@/components/rounds/vegas-section";
import { CreateQuotaForm } from "@/components/rounds/quota-section";
import { CreateNinesForm } from "@/components/rounds/nines-section";
import { CreateTwosForm } from "@/components/rounds/twos-section";
import { CreateMatchPlayForm } from "@/components/rounds/match-play-section";
import { CreateStrokePlayForm, CreateStablefordForm } from "@/components/rounds/stroke-play-section";
import {
  CreateBestBallForm,
  CreateWorstBallForm,
  CreateShambleForm,
  CreateLoneRangerForm,
  CreateChaChaChaForm,
  CreateOneGrossOneNetForm,
} from "@/components/rounds/team-stroke-section";
import {
  CreateTeamAverageForm,
  CreateLowBallLowTotalForm,
  CreateLowHandicapHighHandicapForm,
  CreateLowBallHighBallForm,
} from "@/components/rounds/team-prize-section";

type GameTypeId =
  | "nassau"
  | "skins"
  | "wolf"
  | "vegas"
  | "quota"
  | "nines"
  | "twos"
  | "match_play"
  | "stroke_play"
  | "stableford"
  | "best_ball"
  | "worst_ball"
  | "shamble"
  | "team_average"
  | "lone_ranger"
  | "cha_cha_cha"
  | "one_gross_one_net"
  | "low_ball_high_ball"
  | "low_ball_low_total"
  | "low_handicap_high_handicap";

interface GameTypeDef {
  id: GameTypeId;
  name: string;
  category: "individual" | "team";
  playerHint: string;
  minPlayers: number;
}

/**
 * The compact "which format do you want to start" list -- name + player
 * count, nothing else, per the redesign: previously every game type
 * rendered as an always-expanded Card with its full create form inline,
 * which buried the "just pick a game" decision under a wall of fields.
 * Clicking a row expands that one game's existing Create*Form in place
 * (imported from its own section file rather than duplicated here); the
 * form's onSuccess callback collapses it again once the game is created.
 * Only one row is ever expanded at a time.
 */
const GAME_TYPES: GameTypeDef[] = [
  { id: "skins", name: "Skins", category: "individual", playerHint: "2+ players", minPlayers: 2 },
  { id: "wolf", name: "Wolf", category: "individual", playerHint: "Exactly 4 players", minPlayers: 4 },
  { id: "quota", name: "Quota", category: "individual", playerHint: "2+ players", minPlayers: 2 },
  { id: "nines", name: "Nines", category: "individual", playerHint: "Exactly 3 players", minPlayers: 3 },
  { id: "twos", name: "Twos Club", category: "individual", playerHint: "2+ players", minPlayers: 2 },
  { id: "match_play", name: "Match Play", category: "individual", playerHint: "2 players", minPlayers: 2 },
  { id: "stroke_play", name: "Stroke Play", category: "individual", playerHint: "2+ players", minPlayers: 2 },
  { id: "stableford", name: "Stableford", category: "individual", playerHint: "2+ players", minPlayers: 2 },
  { id: "nassau", name: "Nassau", category: "team", playerHint: "2 sides", minPlayers: 2 },
  { id: "vegas", name: "Vegas", category: "team", playerHint: "2 vs 2", minPlayers: 4 },
  { id: "best_ball", name: "Best Ball", category: "team", playerHint: "2 sides", minPlayers: 2 },
  { id: "worst_ball", name: "Worst Ball", category: "team", playerHint: "2 sides", minPlayers: 2 },
  { id: "shamble", name: "Shamble", category: "team", playerHint: "2 sides", minPlayers: 2 },
  { id: "team_average", name: "Team Average", category: "team", playerHint: "2 sides", minPlayers: 2 },
  { id: "lone_ranger", name: "Lone Ranger", category: "team", playerHint: "1 vs the rest", minPlayers: 3 },
  { id: "cha_cha_cha", name: "Cha Cha Cha", category: "team", playerHint: "2 sides, 2+ each", minPlayers: 4 },
  { id: "one_gross_one_net", name: "One Gross One Net", category: "team", playerHint: "2 sides", minPlayers: 2 },
  { id: "low_ball_high_ball", name: "Low Ball High Ball", category: "team", playerHint: "2 vs 2", minPlayers: 4 },
  { id: "low_ball_low_total", name: "Low Ball Low Total", category: "team", playerHint: "2 sides", minPlayers: 2 },
  { id: "low_handicap_high_handicap", name: "Low Handicap High Handicap", category: "team", playerHint: "2 vs 2", minPlayers: 4 },
];

export function GameTypePicker({
  roundId,
  tripId,
  isCaptain,
  players,
  monetaryEnabled,
}: {
  roundId: string;
  tripId: string;
  isCaptain: boolean;
  players: PlayerOption[];
  monetaryEnabled: boolean;
}) {
  const [expandedId, setExpandedId] = useState<GameTypeId | null>(null);

  if (!isCaptain) return null;

  function renderForm(id: GameTypeId) {
    const onSuccess = () => setExpandedId(null);
    switch (id) {
      case "nassau":
        return (
          <CreateNassauForm roundId={roundId} tripId={tripId} players={players} monetaryEnabled={monetaryEnabled} onSuccess={onSuccess} />
        );
      case "skins":
        return (
          <CreateSkinsForm roundId={roundId} tripId={tripId} players={players} monetaryEnabled={monetaryEnabled} onSuccess={onSuccess} />
        );
      case "wolf":
        return (
          <CreateWolfForm roundId={roundId} tripId={tripId} players={players} monetaryEnabled={monetaryEnabled} onSuccess={onSuccess} />
        );
      case "vegas":
        return (
          <CreateVegasForm roundId={roundId} tripId={tripId} players={players} monetaryEnabled={monetaryEnabled} onSuccess={onSuccess} />
        );
      case "quota":
        return (
          <CreateQuotaForm roundId={roundId} tripId={tripId} players={players} monetaryEnabled={monetaryEnabled} onSuccess={onSuccess} />
        );
      case "nines":
        return (
          <CreateNinesForm roundId={roundId} tripId={tripId} players={players} monetaryEnabled={monetaryEnabled} onSuccess={onSuccess} />
        );
      case "twos":
        return (
          <CreateTwosForm roundId={roundId} tripId={tripId} players={players} monetaryEnabled={monetaryEnabled} onSuccess={onSuccess} />
        );
      case "match_play":
        return (
          <CreateMatchPlayForm roundId={roundId} tripId={tripId} players={players} monetaryEnabled={monetaryEnabled} onSuccess={onSuccess} />
        );
      case "stroke_play":
        return (
          <CreateStrokePlayForm roundId={roundId} tripId={tripId} players={players} monetaryEnabled={monetaryEnabled} onSuccess={onSuccess} />
        );
      case "stableford":
        return (
          <CreateStablefordForm roundId={roundId} tripId={tripId} players={players} monetaryEnabled={monetaryEnabled} onSuccess={onSuccess} />
        );
      case "best_ball":
        return (
          <CreateBestBallForm roundId={roundId} tripId={tripId} players={players} monetaryEnabled={monetaryEnabled} onSuccess={onSuccess} />
        );
      case "worst_ball":
        return (
          <CreateWorstBallForm roundId={roundId} tripId={tripId} players={players} monetaryEnabled={monetaryEnabled} onSuccess={onSuccess} />
        );
      case "shamble":
        return (
          <CreateShambleForm roundId={roundId} tripId={tripId} players={players} monetaryEnabled={monetaryEnabled} onSuccess={onSuccess} />
        );
      case "team_average":
        return (
          <CreateTeamAverageForm roundId={roundId} tripId={tripId} players={players} monetaryEnabled={monetaryEnabled} onSuccess={onSuccess} />
        );
      case "lone_ranger":
        return (
          <CreateLoneRangerForm roundId={roundId} tripId={tripId} players={players} monetaryEnabled={monetaryEnabled} onSuccess={onSuccess} />
        );
      case "cha_cha_cha":
        return (
          <CreateChaChaChaForm roundId={roundId} tripId={tripId} players={players} monetaryEnabled={monetaryEnabled} onSuccess={onSuccess} />
        );
      case "one_gross_one_net":
        return (
          <CreateOneGrossOneNetForm roundId={roundId} tripId={tripId} players={players} monetaryEnabled={monetaryEnabled} onSuccess={onSuccess} />
        );
      case "low_ball_high_ball":
        return (
          <CreateLowBallHighBallForm roundId={roundId} tripId={tripId} players={players} monetaryEnabled={monetaryEnabled} onSuccess={onSuccess} />
        );
      case "low_ball_low_total":
        return (
          <CreateLowBallLowTotalForm roundId={roundId} tripId={tripId} players={players} monetaryEnabled={monetaryEnabled} onSuccess={onSuccess} />
        );
      case "low_handicap_high_handicap":
        return (
          <CreateLowHandicapHighHandicapForm
            roundId={roundId}
            tripId={tripId}
            players={players}
            monetaryEnabled={monetaryEnabled}
            onSuccess={onSuccess}
          />
        );
    }
  }

  function renderRow(g: GameTypeDef) {
    const eligible = players.length >= g.minPlayers;
    const isOpen = expandedId === g.id;
    return (
      <div key={g.id} className="border-b border-charcoal-400/10 last:border-b-0">
        <button
          type="button"
          disabled={!eligible}
          onClick={() => setExpandedId(isOpen ? null : g.id)}
          className="flex w-full items-center justify-between gap-3 py-3 text-left disabled:cursor-not-allowed disabled:opacity-40"
        >
          <span className="text-sm font-medium text-charcoal-800">{g.name}</span>
          <span className="flex items-center gap-2 text-xs text-charcoal-500">
            {g.playerHint}
            <span aria-hidden className={`inline-block transition-transform ${isOpen ? "rotate-180" : ""}`}>
              ⌄
            </span>
          </span>
        </button>
        {!eligible && (
          <p className="pb-3 text-xs text-charcoal-400">
            Needs {g.minPlayers}+ golfers in this round — you have {players.length}.
          </p>
        )}
        {isOpen && <div className="pb-4">{renderForm(g.id)}</div>}
      </div>
    );
  }

  const individual = GAME_TYPES.filter((g) => g.category === "individual");
  const team = GAME_TYPES.filter((g) => g.category === "team");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Start a game</CardTitle>
        <CardDescription>Pick a format — tap it to add players and start.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-charcoal-400">Individual</p>
          {individual.map(renderRow)}
        </div>
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-charcoal-400">Team</p>
          {team.map(renderRow)}
        </div>
      </CardContent>
    </Card>
  );
}
