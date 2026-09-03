import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GOLF_SCORING_ENABLED, SIDE_GAMES_ENABLED, MONETARY_GAME_VALUES_ENABLED } from "@/lib/config";
import { ButtonLink } from "@/components/ui/button";
import {
  computeMatchStatus,
  segmentHoleNumbers,
  type Segment,
} from "@/lib/golf/nassau";
import { computeSkins } from "@/lib/golf/skins";
import type { PlayerScoreInput, HoleSpec } from "@/lib/golf/scoring";
import { SideGamesSection, type NassauGameView, type SkinsGameView } from "@/components/rounds/side-games-section";
import type { SnapshotTeeSet } from "@/components/rounds/mobile-scorecard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Games" };

const SEGMENT_LABEL: Record<Segment, string> = { front: "Front 9", back: "Back 9", overall: "Overall" };

function segmentEndHole(segment: Segment, holeCount: number): number {
  if (segment === "front") return 9;
  return holeCount;
}

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

  const [{ data: round }, { data: snapshot }, { data: myMembership }] = await Promise.all([
    supabase.from("rounds").select("*").eq("id", roundId).maybeSingle(),
    supabase.from("round_course_snapshots").select("*").eq("round_id", roundId).maybeSingle(),
    supabase
      .from("trip_members")
      .select("role, status")
      .eq("trip_id", tripId)
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  if (!round || round.trip_id !== tripId) {
    notFound();
  }

  const isCaptain = myMembership?.role === "captain" && myMembership.status === "active";

  const { data: playerRows } = await supabase
    .from("round_players")
    .select("id, tee_set_name, playing_handicap, trip_members(display_name, user_id)")
    .eq("round_id", roundId);

  const rows = playerRows ?? [];
  const roundPlayerIds = rows.map((r) => r.id);

  const { data: scoreRows } =
    roundPlayerIds.length > 0
      ? await supabase
          .from("hole_scores")
          .select("round_player_id, hole_number, gross_strokes")
          .in("round_player_id", roundPlayerIds)
      : { data: [] };

  const teeSets = (snapshot?.tee_sets as SnapshotTeeSet[] | null) ?? [];
  const holesByTeeSet = new Map<string, SnapshotTeeSet["holes"]>();
  for (const ts of teeSets) holesByTeeSet.set(ts.name, ts.holes);

  const players = rows.map((r) => {
    const member = Array.isArray(r.trip_members) ? r.trip_members[0] : r.trip_members;
    return {
      roundPlayerId: r.id,
      displayName: member?.display_name ?? "Unknown golfer",
      teeSetName: r.tee_set_name,
      playingHandicap: r.playing_handicap,
      userId: member?.user_id ?? null,
    };
  });
  const displayNameById = new Map(players.map((p) => [p.roundPlayerId, p.displayName]));
  const myRoundPlayerId = players.find((p) => p.userId === user.id)?.roundPlayerId ?? null;

  const grossByPlayer = new Map<string, Map<number, number | null>>();
  for (const p of players) {
    const m = new Map<number, number | null>();
    for (let h = 1; h <= round.hole_count; h++) m.set(h, null);
    grossByPlayer.set(p.roundPlayerId, m);
  }
  for (const s of scoreRows ?? []) {
    grossByPlayer.get(s.round_player_id)?.set(s.hole_number, s.gross_strokes);
  }

  const scoreInputById = new Map<string, PlayerScoreInput>(
    players.map((p) => {
      const holes: HoleSpec[] = ((p.teeSetName ? holesByTeeSet.get(p.teeSetName) : undefined) ?? teeSets[0]?.holes ?? []).map(
        (h) => ({ holeNumber: h.hole_number, par: h.par, strokeIndex: h.stroke_index }),
      );
      return [
        p.roundPlayerId,
        {
          roundPlayerId: p.roundPlayerId,
          playingHandicap: p.playingHandicap,
          holes,
          grossByHole: grossByPlayer.get(p.roundPlayerId) ?? new Map(),
        },
      ];
    }),
  );

  const { data: gameRows } = await supabase
    .from("side_games")
    .select("*, side_game_participants(*), side_game_presses(*)")
    .eq("round_id", roundId)
    .order("created_at", { ascending: true });

  const nassauGames: NassauGameView[] = [];
  const skinsGames: SkinsGameView[] = [];

  for (const game of gameRows ?? []) {
    const participants = game.side_game_participants ?? [];
    const metric = game.scoring_metric;

    if (game.game_type === "nassau") {
      const side1 = participants.filter((p) => p.side === 1).map((p) => scoreInputById.get(p.round_player_id)).filter((p): p is PlayerScoreInput => !!p);
      const side2 = participants.filter((p) => p.side === 2).map((p) => scoreInputById.get(p.round_player_id)).filter((p): p is PlayerScoreInput => !!p);

      const segments = (["front", "back", "overall"] as Segment[]).map((segment) => {
        const holeNumbers = segmentHoleNumbers(segment, round.hole_count).filter((h) => h <= round.hole_count);
        const status = computeMatchStatus(side1, side2, holeNumbers, metric);
        return { segment, label: `${SEGMENT_LABEL[segment]}: ${status.label}`, clinched: status.clinched };
      });

      const presses = (game.side_game_presses ?? []).map((press) => {
        const segment = press.segment as Segment;
        const end = segmentEndHole(segment, round.hole_count);
        const holeNumbers = Array.from({ length: Math.max(0, end - press.starting_hole + 1) }, (_, i) => press.starting_hole + i);
        const status = computeMatchStatus(side1, side2, holeNumbers, metric);
        return {
          id: press.id,
          label: `Press from hole ${press.starting_hole} (${SEGMENT_LABEL[segment]}): ${status.label}`,
        };
      });

      nassauGames.push({
        id: game.id,
        name: game.name,
        scoringMetric: metric,
        isMonetary: game.is_monetary,
        dollarValue: game.dollar_value,
        side1Names: participants.filter((p) => p.side === 1).map((p) => displayNameById.get(p.round_player_id) ?? "Golfer"),
        side2Names: participants.filter((p) => p.side === 2).map((p) => displayNameById.get(p.round_player_id) ?? "Golfer"),
        participantIds: participants.map((p) => p.round_player_id),
        segments,
        presses,
      });
    } else {
      const gamePlayers = participants.map((p) => scoreInputById.get(p.round_player_id)).filter((p): p is PlayerScoreInput => !!p);
      const holeNumbers = segmentHoleNumbers("overall", round.hole_count);
      const result = computeSkins(gamePlayers, holeNumbers, metric, game.carryover);

      const standings = Array.from(result.totalsByPlayer.entries())
        .map(([roundPlayerId, skinsWon]) => ({
          roundPlayerId,
          displayName: displayNameById.get(roundPlayerId) ?? "Golfer",
          skinsWon,
        }))
        .sort((a, b) => b.skinsWon - a.skinsWon);

      skinsGames.push({
        id: game.id,
        name: game.name,
        scoringMetric: metric,
        isMonetary: game.is_monetary,
        dollarValue: game.dollar_value,
        carryover: game.carryover,
        standings,
        holes: result.holes.map((h) => ({
          holeNumber: h.holeNumber,
          winnerName: h.winnerRoundPlayerId ? (displayNameById.get(h.winnerRoundPlayerId) ?? "Golfer") : null,
          skinsWon: h.skinsWon,
          carriedOver: h.carriedOver,
        })),
        pendingPot: result.pendingPot,
      });
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl">Games</h1>
        <ButtonLink href={`/trips/${tripId}/rounds/${roundId}`} variant="ghost" size="sm">
          Details
        </ButtonLink>
      </div>

      <SideGamesSection
        tripId={tripId}
        roundId={roundId}
        isCaptain={isCaptain}
        myRoundPlayerId={myRoundPlayerId}
        players={players.map((p) => ({ roundPlayerId: p.roundPlayerId, displayName: p.displayName }))}
        nassauGames={nassauGames}
        skinsGames={skinsGames}
        monetaryEnabled={MONETARY_GAME_VALUES_ENABLED}
      />
    </div>
  );
}
