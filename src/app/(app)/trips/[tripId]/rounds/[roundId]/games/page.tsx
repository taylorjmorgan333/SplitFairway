import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GOLF_SCORING_ENABLED, SIDE_GAMES_ENABLED, MONETARY_GAME_VALUES_ENABLED, LIVE_LEADERBOARD_ENABLED } from "@/lib/config";
import { GameTypePicker } from "@/components/rounds/game-type-picker";
import { RoundPhaseTabs } from "@/components/rounds/round-nav";
import { RoundContextHeader } from "@/components/rounds/round-context-header";
import { ActiveGamesSummary, type ActiveGameSummary } from "@/components/rounds/active-games-summary";
import { computeSkins } from "@/lib/golf/skins";
import { segmentHoleNumbers } from "@/lib/golf/nassau";
import type { PlayerScoreInput, HoleSpec } from "@/lib/golf/scoring";
import type { SnapshotTeeSet } from "@/components/rounds/mobile-scorecard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Games" };

/** Display name for every non-skins game type, used only for the generic
 * Active Games card -- the leaderboard-style card is specific to Skins. */
const GAME_TYPE_LABEL: Record<string, string> = {
  nassau: "Nassau",
  wolf: "Wolf",
  vegas: "Vegas",
  quota: "Quota",
  nines: "Nines",
  twos: "Twos Club",
  match_play: "Match Play",
  stroke_play: "Stroke Play",
  stableford: "Stableford",
  best_ball: "Best Ball",
  worst_ball: "Worst Ball",
  shamble: "Shamble",
  team_average: "Team Average",
  lone_ranger: "Lone Ranger",
  cha_cha_cha: "Cha Cha Cha",
  one_gross_one_net: "One Gross One Net",
  low_ball_high_ball: "Low Ball High Ball",
  low_ball_low_total: "Low Ball Low Total",
  low_handicap_high_handicap: "Low Handicap High Handicap",
  custom: "Custom Game",
};

/**
 * The Games screen: what's already in play for this round, plus the
 * entry point to add more. Reworked so it never asks "is your group
 * playing any games?" once a game already exists (it used to re-ask
 * every visit, ignoring the games already saved), and so it never
 * shows a live dollar balance or a "such and such is up -$X" style
 * phrase -- those numbers stay on Game Details and Settle Up. Skins
 * standings here come from the exact same computeSkins() Game Details
 * uses; nothing about how any game is scored changes on this page.
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

  const [{ data: round }, { data: snapshot }, { data: myMembership }, { data: gameRows }] = await Promise.all([
    supabase.from("rounds").select("*").eq("id", roundId).maybeSingle(),
    supabase.from("round_course_snapshots").select("*").eq("round_id", roundId).maybeSingle(),
    supabase.from("trip_members").select("role, status").eq("trip_id", tripId).eq("user_id", user.id).maybeSingle(),
    supabase
      .from("side_games")
      .select("id, name, game_type, scoring_metric, carryover, side_game_participants(round_player_id)")
      .eq("round_id", roundId)
      .order("created_at", { ascending: true }),
  ]);

  if (!round || round.trip_id !== tripId) {
    notFound();
  }

  const isCaptain = myMembership?.role === "captain" && myMembership.status === "active";
  const hasAnyGames = (gameRows ?? []).length > 0;

  const { data: playerRows } = await supabase
    .from("round_players")
    .select("id, tee_set_name, playing_handicap, trip_members(display_name)")
    .eq("round_id", roundId);

  const rows = playerRows ?? [];
  const playerOptions = rows.map((r) => {
    const member = Array.isArray(r.trip_members) ? r.trip_members[0] : r.trip_members;
    return { roundPlayerId: r.id, displayName: member?.display_name ?? "Unknown golfer" };
  });
  const displayNameById = new Map(playerOptions.map((p) => [p.roundPlayerId, p.displayName]));

  const roundPlayerIds = rows.map((r) => r.id);
  const { data: scoreRows } =
    roundPlayerIds.length > 0
      ? await supabase
          .from("hole_scores")
          .select("round_player_id, hole_number, gross_strokes")
          .in("round_player_id", roundPlayerIds)
      : { data: [] };

  const enteredCountByHole = new Map<number, number>();
  for (const s of scoreRows ?? []) {
    enteredCountByHole.set(s.hole_number, (enteredCountByHole.get(s.hole_number) ?? 0) + 1);
  }
  const golferCount = playerOptions.length;
  const holesCompletedForTabs =
    golferCount > 0 ? [...enteredCountByHole.values()].filter((n) => n >= golferCount).length : 0;
  const holesRemainingForTabs = Math.max(0, round.hole_count - holesCompletedForTabs);
  const scoresComplete = golferCount > 0 && holesRemainingForTabs === 0;

  // Same player-score-input shape Game Details builds, so Skins here
  // is computed by the identical engine -- this is a second view of
  // that math, not a second implementation of it.
  const teeSets = (snapshot?.tee_sets as SnapshotTeeSet[] | null) ?? [];
  const holesByTeeSet = new Map<string, SnapshotTeeSet["holes"]>();
  for (const ts of teeSets) holesByTeeSet.set(ts.name, ts.holes);

  const grossByPlayer = new Map<string, Map<number, number | null>>();
  for (const r of rows) {
    const m = new Map<number, number | null>();
    for (let h = 1; h <= round.hole_count; h++) m.set(h, null);
    grossByPlayer.set(r.id, m);
  }
  for (const s of scoreRows ?? []) {
    grossByPlayer.get(s.round_player_id)?.set(s.hole_number, s.gross_strokes);
  }

  const scoreInputById = new Map<string, PlayerScoreInput>(
    rows.map((r) => {
      const holes: HoleSpec[] = ((r.tee_set_name ? holesByTeeSet.get(r.tee_set_name) : undefined) ?? teeSets[0]?.holes ?? []).map(
        (h) => ({ holeNumber: h.hole_number, par: h.par, strokeIndex: h.stroke_index }),
      );
      return [
        r.id,
        {
          roundPlayerId: r.id,
          playingHandicap: r.playing_handicap,
          holes,
          grossByHole: grossByPlayer.get(r.id) ?? new Map(),
        },
      ];
    }),
  );

  const overallHoleNumbers = segmentHoleNumbers("overall", round.hole_count);

  const activeGames: ActiveGameSummary[] = (gameRows ?? []).map((game) => {
    if (game.game_type === "skins") {
      const gamePlayers = (game.side_game_participants ?? [])
        .map((p) => scoreInputById.get(p.round_player_id))
        .filter((p): p is PlayerScoreInput => !!p);
      const result = computeSkins(gamePlayers, overallHoleNumbers, game.scoring_metric, game.carryover);

      const sortedStandings = Array.from(result.totalsByPlayer.entries())
        .map(([roundPlayerId, skinsWon]) => ({
          roundPlayerId,
          displayName: displayNameById.get(roundPlayerId) ?? "Golfer",
          skinsWon,
        }))
        .sort((a, b) => b.skinsWon - a.skinsWon);

      // Standard competition ranking: players tied on skins share the
      // same position (1, 1, 3 -- not 1, 1, 2).
      let rank = 0;
      let previousSkins: number | null = null;
      const standings = sortedStandings.map((s, i) => {
        if (previousSkins === null || s.skinsWon !== previousSkins) rank = i + 1;
        previousSkins = s.skinsWon;
        return { ...s, rank };
      });

      const skinsAwarded = Array.from(result.totalsByPlayer.values()).reduce((sum, n) => sum + n, 0);

      return {
        kind: "skins",
        id: game.id,
        name: game.name,
        standings,
        skinsAwarded,
        skinsCarriedOver: Math.max(0, result.pendingPot - 1),
        holesRemaining: Math.max(0, round.hole_count - result.holes.length),
      };
    }

    return {
      kind: "other",
      id: game.id,
      name: game.name,
      gameTypeLabel: GAME_TYPE_LABEL[game.game_type] ?? game.game_type,
    };
  });

  return (
    <div className="mx-auto max-w-2xl">
      <RoundContextHeader
        roundName={round.name}
        courseName={snapshot?.course_name ?? "Course"}
        courseLocation={
          snapshot?.course_city ? `${snapshot.course_city}${snapshot.course_state ? `, ${snapshot.course_state}` : ""}` : null
        }
        roundDate={round.round_date}
      />
      <RoundPhaseTabs
        tripId={tripId}
        roundId={roundId}
        status={round.status}
        sideGamesEnabled={SIDE_GAMES_ENABLED}
        leaderboardEnabled={LIVE_LEADERBOARD_ENABLED}
        scoresComplete={scoresComplete}
      />

      <div className="space-y-6">
        <ActiveGamesSummary tripId={tripId} roundId={roundId} isCaptain={isCaptain} games={activeGames} />

        <GameTypePicker
          roundId={roundId}
          tripId={tripId}
          isCaptain={isCaptain}
          players={playerOptions}
          monetaryEnabled={MONETARY_GAME_VALUES_ENABLED}
          hasAnyGames={hasAnyGames}
        />
      </div>
    </div>
  );
}
