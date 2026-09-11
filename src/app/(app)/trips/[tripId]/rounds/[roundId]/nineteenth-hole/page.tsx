import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  GOLF_SCORING_ENABLED,
  SIDE_GAMES_ENABLED,
  LIVE_LEADERBOARD_ENABLED,
  NINETEENTH_HOLE_ENABLED,
} from "@/lib/config";
import { RoundPhaseTabs } from "@/components/rounds/round-nav";
import { RoundContextHeader } from "@/components/rounds/round-context-header";
import { NineteenthHoleTab } from "@/components/nineteenth-hole/nineteenth-hole-tab";
import { buildRecorderNameByUserId, loadNineteenthHoleTripData } from "@/lib/nineteenth-hole/data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "19th Hole" };

/**
 * The round-scoped entry point into The 19th Hole -- same feature, same
 * data, same <NineteenthHoleTab> the trip-level tab renders, just
 * pre-scoped to this round (new activity recorded from here is tagged
 * with this round's id) so it can sit "alongside Scorecard and Games"
 * as its own nav tab. See src/lib/nineteenth-hole/data.ts for the
 * shared loader both entry points use.
 */
export default async function RoundNineteenthHolePage({
  params,
}: {
  params: Promise<{ tripId: string; roundId: string }>;
}) {
  if (!GOLF_SCORING_ENABLED || !NINETEENTH_HOLE_ENABLED) {
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

  const [{ data: round }, { data: snapshot }, { data: myMembership }, { data: memberRows }] = await Promise.all([
    supabase.from("rounds").select("*").eq("id", roundId).maybeSingle(),
    supabase.from("round_course_snapshots").select("*").eq("round_id", roundId).maybeSingle(),
    supabase.from("trip_members").select("id, role, status").eq("trip_id", tripId).eq("user_id", user.id).maybeSingle(),
    supabase
      .from("trip_members")
      .select("id, display_name, user_id, status")
      .eq("trip_id", tripId)
      .order("created_at", { ascending: true }),
  ]);

  if (!round || round.trip_id !== tripId) {
    notFound();
  }

  const isCaptain = myMembership?.role === "captain" && myMembership.status === "active";
  const allMembers = memberRows ?? [];
  const activeMembers = allMembers.filter((m) => m.status === "active");

  const nh = await loadNineteenthHoleTripData(supabase, tripId);
  const recorderNameByUserId = buildRecorderNameByUserId(allMembers);

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
        nineteenthHoleEnabled={NINETEENTH_HOLE_ENABLED}
      />

      <NineteenthHoleTab
        tripId={tripId}
        isCaptain={isCaptain}
        currentUserId={user.id}
        members={activeMembers.map((m) => ({ id: m.id, displayName: m.display_name }))}
        rounds={nh.rounds}
        recorderNameByUserId={recorderNameByUserId}
        initialSettings={nh.settings}
        initialCounters={nh.counters}
        initialActivity={nh.activity}
        initialRoundId={roundId}
      />
    </div>
  );
}
