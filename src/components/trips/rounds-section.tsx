import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { formatDate, formatTeeTime } from "@/lib/utils";
import {
  dashboardActionForRound,
  primaryHrefForRound,
  gamesHrefForRound,
  type RoundStatus,
} from "@/components/rounds/round-phase";

export interface RoundSummary {
  id: string;
  name: string | null;
  courseName: string;
  roundDate: string;
  startTime: string | null;
  holeCount: number;
  status: RoundStatus;
  golferCount: number;
}

export interface InProgressSummary {
  roundId: string;
  holesCompleted: number;
  holeCount: number;
}

/**
 * The trip dashboard's golf module: one bounded "Rounds" section, never
 * an open-ended list of every scoring feature. Each round is a single
 * card with exactly one obvious primary action (its Games link is
 * deliberately small and secondary) — the goal is "easy to discover,"
 * not "as prominent as the balances above it."
 */
export function RoundsSection({
  tripId,
  isCaptain,
  rounds,
  inProgress,
  sideGamesEnabled,
  leaderboardEnabled,
}: {
  tripId: string;
  isCaptain: boolean;
  rounds: RoundSummary[];
  inProgress: InProgressSummary | null;
  sideGamesEnabled: boolean;
  leaderboardEnabled: boolean;
}) {
  // No golf event on this trip at all yet -- skip the module entirely
  // rather than show an empty "Rounds" shell with nothing in it. This
  // one card (never a blank one) is what "no golf event" and "a golf
  // event but no connected round" both collapse to here, since a round
  // row is the only thing that represents a golf event in this app --
  // there's no separate itinerary/tee-time record to distinguish them.
  if (rounds.length === 0) {
    return (
      <Card>
        <CardContent className="space-y-4 p-5 sm:p-6">
          <div>
            <p className="font-serif text-lg text-forest-900">Ready to keep score?</p>
            <p className="mt-1.5 text-base leading-relaxed text-charcoal-600">
              {isCaptain
                ? "Set up the scorecard, choose the players and add any games your group is playing."
                : "Your trip captain hasn't set up a round yet."}
            </p>
          </div>
          {isCaptain && (
            <ButtonLink href={`/trips/${tripId}/rounds/new`} size="lg" className="flex w-full justify-center sm:w-auto">
              Set Up Round
            </ButtonLink>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-serif text-xl text-forest-900">Rounds</h2>
        <ButtonLink href={`/trips/${tripId}/rounds`} variant="ghost" size="sm" className="text-base">
          See all rounds
        </ButtonLink>
      </div>

      {inProgress && (
        <Card className="border-forest-700/20 bg-forest-50">
          <CardContent className="space-y-3 p-5 sm:p-6">
            <div>
              <p className="font-serif text-lg text-forest-900">Round in progress</p>
              <p className="mt-1 text-base text-charcoal-600">
                {inProgress.holesCompleted} of {inProgress.holeCount} holes completed
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <ButtonLink
                href={`/trips/${tripId}/rounds/${inProgress.roundId}/score`}
                size="md"
                className="flex-1 justify-center sm:flex-none"
              >
                Continue Scoring
              </ButtonLink>
              {leaderboardEnabled && (
                <ButtonLink
                  href={`/trips/${tripId}/rounds/${inProgress.roundId}/leaderboard`}
                  variant="outline"
                  size="md"
                  className="flex-1 justify-center sm:flex-none"
                >
                  View Leaderboard
                </ButtonLink>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {rounds.map((round) => (
          <RoundCard
            key={round.id}
            tripId={tripId}
            round={round}
            sideGamesEnabled={sideGamesEnabled}
          />
        ))}
      </div>
    </div>
  );
}

function RoundCard({
  tripId,
  round,
  sideGamesEnabled,
}: {
  tripId: string;
  round: RoundSummary;
  sideGamesEnabled: boolean;
}) {
  const action = dashboardActionForRound(round.status, round.golferCount);
  const heading = round.name || round.courseName;
  const showCourseSubtitle = Boolean(round.name);

  const golferLabel =
    round.golferCount === 0
      ? "No golfers added yet"
      : `${round.golferCount} golfer${round.golferCount === 1 ? "" : "s"}`;

  return (
    <Card>
      <CardContent className="space-y-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-base font-medium text-forest-900">{heading}</p>
            {showCourseSubtitle && <p className="mt-0.5 text-base text-charcoal-500">{round.courseName}</p>}
            <p className="mt-1.5 text-base text-charcoal-600">
              {formatDate(round.roundDate)}
              {round.startTime ? ` · ${formatTeeTime(round.startTime)}` : ""}
            </p>
            <p className="mt-1 text-base text-charcoal-600">{golferLabel}</p>
          </div>
          <Badge variant={action.badgeVariant}>{action.statusLabel}</Badge>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <ButtonLink
            href={primaryHrefForRound(tripId, round.id, action.state)}
            size="md"
            className="flex-1 justify-center sm:flex-none"
          >
            {action.primaryLabel}
          </ButtonLink>
          {sideGamesEnabled && (
            <ButtonLink
              href={gamesHrefForRound(tripId, round.id, action.state)}
              variant="ghost"
              size="sm"
              className="text-base"
            >
              Games
            </ButtonLink>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
