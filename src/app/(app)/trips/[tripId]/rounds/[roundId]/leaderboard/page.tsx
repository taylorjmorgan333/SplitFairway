import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GOLF_SCORING_ENABLED, LIVE_LEADERBOARD_ENABLED, SIDE_GAMES_ENABLED } from "@/lib/config";
import { ButtonLink } from "@/components/ui/button";
import { LiveLeaderboard } from "@/components/rounds/live-leaderboard";
import { RoundPhaseTabs } from "@/components/rounds/round-nav";
import type { SnapshotTeeSet } from "@/components/rounds/mobile-scorecard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Leaderboard" };

export default async function LeaderboardPage({
  params,
}: {
  params: Promise<{ tripId: string; roundId: string }>;
}) {
  if (!GOLF_SCORING_ENABLED || !LIVE_LEADERBOARD_ENABLED) {
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

  // rounds_select_members RLS already means this query returns null for
  // anyone who isn't a trip member -- notFound() here just turns that
  // into the right page instead of rendering with nothing.
  if (!round || round.trip_id !== tripId) {
    notFound();
  }

  const isCaptain = myMembership?.role === "captain" && myMembership.status === "active";

  const { data: playerRows } = await supabase
    .from("round_players")
    .select("id, group_id, tee_set_name, playing_handicap, trip_members(display_name, user_id)")
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

  const players = rows.map((r) => {
    // Same embedded-relation-as-array typing quirk handled in score/page.tsx.
    const member = Array.isArray(r.trip_members) ? r.trip_members[0] : r.trip_members;
    return {
      roundPlayerId: r.id,
      displayName: member?.display_name ?? "Unknown golfer",
      userId: member?.user_id ?? null,
      groupId: r.group_id,
      teeSetName: r.tee_set_name,
      playingHandicap: r.playing_handicap,
    };
  });

  return (
    <div className="mx-auto max-w-md">
      <RoundPhaseTabs
        tripId={tripId}
        roundId={roundId}
        status={round.status}
        sideGamesEnabled={SIDE_GAMES_ENABLED}
        leaderboardEnabled={LIVE_LEADERBOARD_ENABLED}
      />
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl">{round.name || "Leaderboard"}</h1>
        <ButtonLink href={`/trips/${tripId}/rounds/${roundId}`} variant="ghost" size="sm">
          Details
        </ButtonLink>
      </div>

      <LiveLeaderboard
        roundId={roundId}
        holeCount={round.hole_count}
        teeSets={(snapshot?.tee_sets as SnapshotTeeSet[] | null) ?? []}
        players={players}
        initialScores={(scoreRows ?? []).map((s) => ({
          roundPlayerId: s.round_player_id,
          holeNumber: s.hole_number,
          grossStrokes: s.gross_strokes,
        }))}
        liveScoreVisibility={round.live_score_visibility}
        isCaptain={isCaptain}
      />
    </div>
  );
}
