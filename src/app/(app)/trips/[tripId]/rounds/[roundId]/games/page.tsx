import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GOLF_SCORING_ENABLED, SIDE_GAMES_ENABLED, MONETARY_GAME_VALUES_ENABLED, LIVE_LEADERBOARD_ENABLED } from "@/lib/config";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { GameTypePicker } from "@/components/rounds/game-type-picker";
import { RoundPhaseTabs } from "@/components/rounds/round-nav";
import { loadRoundResultsData } from "@/lib/golf/round-results-data";
import { formatSignedCents } from "@/lib/golf/settlement";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Games" };

/**
 * The redesign's minimal Games screen: current leader, current
 * balance/points, holes remaining, and a plain-language note -- not
 * the full per-game breakdown every format used to render unconditionally
 * on this page. That full breakdown still exists (nothing was deleted),
 * it just moved to /games/details behind a "See full game details" link,
 * reusing the exact same computation this page used to run inline.
 * Round-wide leader/balance figures are computed by the same loader the
 * Results and Settle Up pages use, so this is a fourth view of the same
 * math, not a fourth implementation of it.
 */
export default async function GamesPage({
  params,
}: {
  params: Promise<{ tripId: string; roundId: string }>;
}) {
  if (!GOLF_SCORING_ENABLED || !SIDE_GAMES_ENABLED) {
    redirect("/dashboard");
  }

  const { tripId, roundId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const [{ data: round }, { data: myMembership }, { data: gameRows }] = await Promise.all([
    supabase.from("rounds").select("*").eq("id", roundId).maybeSingle(),
    supabase.from("trip_members").select("role, status").eq("trip_id", tripId).eq("user_id", user.id).maybeSingle(),
    supabase.from("side_games").select("id").eq("round_id", roundId),
  ]);

  if (!round || round.trip_id !== tripId) {
    notFound();
  }

  const isCaptain = myMembership?.role === "captain" && myMembership.status === "active";
  const hasAnyGames = (gameRows ?? []).length > 0;

  const { data: playerRows } = await supabase
    .from("round_players")
    .select("id, trip_members(display_name)")
    .eq("round_id", roundId);

  const playerOptions = (playerRows ?? []).map((r) => {
    const member = Array.isArray(r.trip_members) ? r.trip_members[0] : r.trip_members;
    return { roundPlayerId: r.id, displayName: member?.display_name ?? "Unknown golfer" };
  });

  const roundPlayerIds = playerOptions.map((p) => p.roundPlayerId);
  const { data: scoreRows } =
    roundPlayerIds.length > 0
      ? await supabase.from("hole_scores").select("hole_number, gross_strokes").in("round_player_id", roundPlayerIds).not("gross_strokes", "is", null)
      : { data: [] };

  const enteredCountByHole = new Map<number, number>();
  for (const s of scoreRows ?? []) {
    enteredCountByHole.set(s.hole_number, (enteredCountByHole.get(s.hole_number) ?? 0) + 1);
  }
  const golferCount = playerOptions.length;
  const holesCompleted =
    golferCount > 0 ? [...enteredCountByHole.values()].filter((n) => n >= golferCount).length : 0;
  const holesRemaining = Math.max(0, round.hole_count - holesCompleted);

  const data = await loadRoundResultsData(tripId, roundId);
  const standings = data.redirectToLogin ? [] : data.standings;
  const displayNameById = data.redirectToLogin ? new Map<string, string>() : data.displayNameById;
  const hasAnyMonetaryGame = !data.redirectToLogin && data.hasAnyMonetaryGame;
  const roundNetEntries = data.redirectToLogin ? [] : data.roundNetEntries;
  const leader = standings[0] ?? null;
  const leaderBalance = leader ? (roundNetEntries.find(([id]) => id === leader.roundPlayerId)?.[1] ?? null) : null;

  return (
    <div className="mx-auto max-w-2xl">
      <RoundPhaseTabs
        tripId={tripId}
        roundId={roundId}
        status={round.status}
        sideGamesEnabled={SIDE_GAMES_ENABLED}
        leaderboardEnabled={LIVE_LEADERBOARD_ENABLED}
      />
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl">Games</h1>
        <ButtonLink href={`/trips/${tripId}/rounds/${roundId}`} variant="ghost" size="sm">
          Details
        </ButtonLink>
      </div>

      {leader ? (
        <Card className="mb-6">
          <CardContent className="space-y-2 p-5 sm:p-6">
            <p className="text-sm font-medium uppercase tracking-wide text-charcoal-400">Current leader</p>
            <p className="font-serif text-2xl text-forest-900">{displayNameById.get(leader.roundPlayerId) ?? "Golfer"}</p>
            <p className="text-base text-charcoal-600">
              {hasAnyMonetaryGame && leaderBalance != null
                ? `Up ${formatSignedCents(leaderBalance)} so far`
                : `Net ${leader.value} so far`}
            </p>
            <p className="text-base text-charcoal-600">
              {holesRemaining > 0
                ? `${holesRemaining} hole${holesRemaining === 1 ? "" : "s"} remaining`
                : "All holes complete"}
            </p>
            <p className="text-sm text-charcoal-400">
              {holesRemaining > 0
                ? "Keep entering scores — standings update as soon as everyone's in for a hole."
                : "Everyone's finished — check Results for the final standings."}
            </p>
            {hasAnyGames && (
              <ButtonLink href={`/trips/${tripId}/rounds/${roundId}/games/details`} variant="outline" size="md" className="mt-2">
                See full game details
              </ButtonLink>
            )}
          </CardContent>
        </Card>
      ) : (
        hasAnyGames && (
          <Card className="mb-6">
            <CardContent className="space-y-2 p-5 sm:p-6">
              <p className="text-base text-charcoal-600">No scores entered yet — standings will show up here once play begins.</p>
              <ButtonLink href={`/trips/${tripId}/rounds/${roundId}/games/details`} variant="outline" size="md">
                See full game details
              </ButtonLink>
            </CardContent>
          </Card>
        )
      )}

      <GameTypePicker
        roundId={roundId}
        tripId={tripId}
        isCaptain={isCaptain}
        players={playerOptions}
        monetaryEnabled={MONETARY_GAME_VALUES_ENABLED}
      />
    </div>
  );
}
