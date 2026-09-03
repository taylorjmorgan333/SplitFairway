import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GOLF_SCORING_ENABLED } from "@/lib/config";
import { ButtonLink } from "@/components/ui/button";
import { MobileScorecard, type SnapshotTeeSet } from "@/components/rounds/mobile-scorecard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Scorecard" };

export default async function ScorePage({
  params,
}: {
  params: Promise<{ tripId: string; roundId: string }>;
}) {
  if (!GOLF_SCORING_ENABLED) {
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
    .select("id, trip_member_id, group_id, tee_set_name, playing_handicap, trip_members(display_name, user_id)")
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
    // Supabase's generated types infer the embedded relation as an
    // array even though trip_member_id is unique per round_player (see
    // round_players_unique_member) -- it's always exactly one row here.
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

  const myPlayer = players.find((p) => p.userId === user.id);
  if (!isCaptain && !myPlayer) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl">{round.name || "Scorecard"}</h1>
        <ButtonLink href={`/trips/${tripId}/rounds/${roundId}`} variant="ghost" size="sm">
          Details
        </ButtonLink>
      </div>

      <MobileScorecard
        tripId={tripId}
        roundId={roundId}
        roundStatus={round.status}
        scoreEditScope={round.score_edit_scope}
        holeCount={round.hole_count}
        teeSets={(snapshot?.tee_sets as SnapshotTeeSet[] | null) ?? []}
        players={players}
        initialScores={(scoreRows ?? []).map((s) => ({
          roundPlayerId: s.round_player_id,
          holeNumber: s.hole_number,
          grossStrokes: s.gross_strokes,
        }))}
        currentUserId={user.id}
        isCaptain={isCaptain}
      />
    </div>
  );
}
