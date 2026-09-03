"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
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
  description: string;
  teamOrIndividual: "Individual" | "Team";
  usesHandicap: boolean;
  playerHint: string;
  minPlayers: number;
}

/**
 * Which four formats show up as the single-select "Main Game" choice --
 * the format most of the group is actually competing at, per the
 * redesign spec. Every other implemented format (Skins, Nassau, Wolf,
 * etc.) is a "Side Game": optional, and any number can be added on top
 * of whichever main game is chosen (or on top of "Just Keep Score").
 * This split is presentation-only -- every format still creates the
 * same *_games row it always has, so nothing about scoring, storage or
 * settlement changes.
 */
const MAIN_GAME_IDS: GameTypeId[] = ["stroke_play", "match_play", "best_ball", "stableford"];

const GAME_TYPES: GameTypeDef[] = [
  {
    id: "stroke_play",
    name: "Stroke Play",
    description: "Every golfer's total score for the round is compared directly — fewest strokes wins.",
    teamOrIndividual: "Individual",
    usesHandicap: false,
    playerHint: "2+ players",
    minPlayers: 2,
  },
  {
    id: "match_play",
    name: "Match Play",
    description: "Two golfers or two teams play hole-by-hole; whoever wins the most holes wins the match.",
    teamOrIndividual: "Individual",
    usesHandicap: true,
    playerHint: "2 players",
    minPlayers: 2,
  },
  {
    id: "best_ball",
    name: "Best Ball",
    description: "Each team counts only its best individual score on every hole.",
    teamOrIndividual: "Team",
    usesHandicap: true,
    playerHint: "2 sides",
    minPlayers: 2,
  },
  {
    id: "stableford",
    name: "Stableford",
    description: "Score points based on how each hole compares to par — most points wins, not fewest strokes.",
    teamOrIndividual: "Individual",
    usesHandicap: true,
    playerHint: "2+ players",
    minPlayers: 2,
  },
  {
    id: "skins",
    name: "Skins",
    description: "Win a hole outright and you win the skin. Tied holes can carry the skin to the next hole.",
    teamOrIndividual: "Individual",
    usesHandicap: true,
    playerHint: "2+ players",
    minPlayers: 2,
  },
  {
    id: "nassau",
    name: "Nassau",
    description: "Three side games in one — front nine, back nine, and the full round.",
    teamOrIndividual: "Team",
    usesHandicap: true,
    playerHint: "2 sides",
    minPlayers: 2,
  },
  {
    id: "wolf",
    name: "Wolf",
    description: "Each hole, one player is the Wolf and picks a partner — or goes it alone for double points.",
    teamOrIndividual: "Individual",
    usesHandicap: true,
    playerHint: "Exactly 4 players",
    minPlayers: 4,
  },
  {
    id: "vegas",
    name: "Vegas",
    description: "Two 2-player teams combine their scores into a two-digit number each hole — low number wins.",
    teamOrIndividual: "Team",
    usesHandicap: true,
    playerHint: "2 vs 2",
    minPlayers: 4,
  },
  {
    id: "quota",
    name: "Quota",
    description: "Each player gets a points target based on handicap and tries to beat it hole by hole.",
    teamOrIndividual: "Individual",
    usesHandicap: true,
    playerHint: "2+ players",
    minPlayers: 2,
  },
  {
    id: "nines",
    name: "Nines",
    description: "Three players split 9 points every hole based on who scores best.",
    teamOrIndividual: "Individual",
    usesHandicap: true,
    playerHint: "Exactly 3 players",
    minPlayers: 3,
  },
  {
    id: "twos",
    name: "Twos Club",
    description: "Anyone who cards a 2 on a hole collects from everyone else in the game.",
    teamOrIndividual: "Individual",
    usesHandicap: false,
    playerHint: "2+ players",
    minPlayers: 2,
  },
  {
    id: "worst_ball",
    name: "Worst Ball",
    description: "Each team counts its worst individual score on every hole — a tougher version of Best Ball.",
    teamOrIndividual: "Team",
    usesHandicap: true,
    playerHint: "2 sides",
    minPlayers: 2,
  },
  {
    id: "shamble",
    name: "Shamble",
    description: "Everyone tees off, the team plays its best drive, then each player finishes the hole on their own.",
    teamOrIndividual: "Team",
    usesHandicap: true,
    playerHint: "2 sides",
    minPlayers: 2,
  },
  {
    id: "team_average",
    name: "Team Average",
    description: "Compares each team's average score across its members instead of a single combined total.",
    teamOrIndividual: "Team",
    usesHandicap: false,
    playerHint: "2 sides",
    minPlayers: 2,
  },
  {
    id: "lone_ranger",
    name: "Lone Ranger",
    description: "One player takes on the rest of the group by themselves, hole by hole.",
    teamOrIndividual: "Individual",
    usesHandicap: true,
    playerHint: "1 vs the rest",
    minPlayers: 3,
  },
  {
    id: "cha_cha_cha",
    name: "Cha Cha Cha",
    description: "How many of your team's scores count changes hole by hole, in a repeating pattern.",
    teamOrIndividual: "Team",
    usesHandicap: false,
    playerHint: "2 sides, 2+ each",
    minPlayers: 4,
  },
  {
    id: "one_gross_one_net",
    name: "One Gross One Net",
    description: "Each team counts its best gross score and its best net score on every hole.",
    teamOrIndividual: "Team",
    usesHandicap: true,
    playerHint: "2 sides",
    minPlayers: 2,
  },
  {
    id: "low_ball_high_ball",
    name: "Low Ball High Ball",
    description: "Each hole, compares the low scorer and, separately, the high scorer between two teams.",
    teamOrIndividual: "Team",
    usesHandicap: false,
    playerHint: "2 vs 2",
    minPlayers: 4,
  },
  {
    id: "low_ball_low_total",
    name: "Low Ball Low Total",
    description: "Compares each team's single best individual score and their combined team total.",
    teamOrIndividual: "Team",
    usesHandicap: false,
    playerHint: "2 sides",
    minPlayers: 2,
  },
  {
    id: "low_handicap_high_handicap",
    name: "Low Handicap High Handicap",
    description: "Pairs the lower-handicap golfers against each other, and the higher-handicap golfers against each other.",
    teamOrIndividual: "Team",
    usesHandicap: true,
    playerHint: "2 vs 2",
    minPlayers: 4,
  },
];

const GAME_BY_ID = new Map(GAME_TYPES.map((g) => [g.id, g]));

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
  const [mainGameId, setMainGameId] = useState<GameTypeId | "none" | null>(null);

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

  function renderCard(g: GameTypeDef, opts: { radio: boolean; checked: boolean; onSelect: () => void }) {
    const eligible = players.length >= g.minPlayers;
    const isOpen = expandedId === g.id;
    return (
      <div
        key={g.id}
        className={cn(
          "rounded-xl border p-4 transition-colors",
          opts.checked ? "border-forest-600 bg-forest-50/60" : "border-charcoal-400/15",
        )}
      >
        <button
          type="button"
          disabled={!eligible}
          onClick={() => {
            opts.onSelect();
            setExpandedId(isOpen ? null : g.id);
          }}
          className="flex w-full items-start gap-3 text-left disabled:cursor-not-allowed disabled:opacity-40"
        >
          <span
            aria-hidden="true"
            className={cn(
              "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center border-2",
              opts.radio ? "rounded-full" : "rounded",
              opts.checked ? "border-forest-700 bg-forest-700" : "border-charcoal-400/40 bg-white",
            )}
          >
            {opts.checked && <span className="h-2 w-2 rounded-full bg-white" />}
          </span>
          <span className="flex-1">
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-base font-medium text-charcoal-800">{g.name}</span>
              <Badge variant={g.teamOrIndividual === "Team" ? "forest" : "neutral"}>{g.teamOrIndividual}</Badge>
            </span>
            <span className="mt-1 block text-sm text-charcoal-500">{g.description}</span>
            <span className="mt-1 block text-xs text-charcoal-400">
              {g.playerHint} · {g.usesHandicap ? "Uses handicaps" : "Handicaps not used"}
            </span>
          </span>
          <span aria-hidden className={cn("mt-1 shrink-0 text-charcoal-400 transition-transform", isOpen && "rotate-180")}>
            ⌄
          </span>
        </button>
        {!eligible && (
          <p className="mt-2 pl-8 text-xs text-charcoal-400">
            Needs {g.minPlayers}+ golfers in this round — you have {players.length}.
          </p>
        )}
        {isOpen && <div className="mt-3 border-t border-charcoal-400/10 pl-8 pt-3">{renderForm(g.id)}</div>}
      </div>
    );
  }

  const mainGames = MAIN_GAME_IDS.map((id) => GAME_BY_ID.get(id)!);
  const sideGames = GAME_TYPES.filter((g) => !MAIN_GAME_IDS.includes(g.id));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Main Game</CardTitle>
          <CardDescription>Select the main format everyone will play. You can add optional side games below.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div
            className={cn(
              "rounded-xl border p-4",
              mainGameId === "none" || mainGameId === null ? "border-forest-600 bg-forest-50/60" : "border-charcoal-400/15",
            )}
          >
            <button
              type="button"
              onClick={() => {
                setMainGameId("none");
                setExpandedId(null);
              }}
              className="flex w-full items-start gap-3 text-left"
            >
              <span
                aria-hidden="true"
                className={cn(
                  "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2",
                  mainGameId === "none" || mainGameId === null ? "border-forest-700 bg-forest-700" : "border-charcoal-400/40 bg-white",
                )}
              >
                {(mainGameId === "none" || mainGameId === null) && <span className="h-2 w-2 rounded-full bg-white" />}
              </span>
              <span>
                <span className="block text-base font-medium text-charcoal-800">Just Keep Score</span>
                <span className="mt-1 block text-sm text-charcoal-500">
                  Track everyone&apos;s scores without adding a competition.
                </span>
              </span>
            </button>
          </div>
          {mainGames.map((g) =>
            renderCard(g, {
              radio: true,
              checked: mainGameId === g.id,
              onSelect: () => setMainGameId(g.id),
            }),
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Optional Side Games</CardTitle>
          <CardDescription>You can play for points, money or bragging rights. Add as many as you&apos;d like, or skip this.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {sideGames.map((g) =>
            renderCard(g, {
              radio: false,
              checked: expandedId === g.id,
              onSelect: () => {},
            }),
          )}
        </CardContent>
      </Card>
    </div>
  );
}
