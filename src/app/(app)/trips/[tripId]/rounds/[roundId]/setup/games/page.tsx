import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GOLF_SCORING_ENABLED, SIDE_GAMES_ENABLED, MONETARY_GAME_VALUES_ENABLED } from "@/lib/config";
import { ButtonLink } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { SetupStepNav } from "@/components/rounds/round-nav";
import { GameTypePicker } from "@/components/rounds/game-type-picker";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Choose Your Games" };

/**
 * Step 3 of the round setup flow. A thin, setup-only wrapper around the
 * same GameTypePicker the live Games page already uses (see
 * .../rounds/[roundId]/games/page.tsx) -- deliberately not the full
 * per-game-results view, since nothing has been played yet. If
 * SIDE_GAMES_ENABLED is off for this trip, game creation is skipped
 * entirely here too (same flag the existing Games page already
 * respects), and this step just explains that and moves on.
 */
export default async function SetupGamesPage({
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

  const [{ data: round }, { data: myMembership }] = await Promise.all([
    supabase.from("rounds").select("id, trip_id, status").eq("id", roundId).maybeSingle(),
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
    .select("id, trip_members(display_name)")
    .eq("round_id", roundId);

  const playerOptions = (playerRows ?? []).map((r) => {
    const member = Array.isArray(r.trip_members) ? r.trip_members[0] : r.trip_members;
    return { roundPlayerId: r.id, displayName: member?.display_name ?? "Unknown golfer" };
  });

  return (
    <div className="mx-auto max-w-2xl pb-28">
      <SetupStepNav tripId={tripId} roundId={round.id} currentStep={3} />

      <h1 className="text-2xl">Games</h1>
      <p className="mt-1 text-base text-charcoal-500">
        Add any games your group is playing, or skip this if you&apos;d rather just keep score.
      </p>

      {!SIDE_GAMES_ENABLED ? (
        <Alert variant="info" className="mt-6">
          Games aren&apos;t turned on for this trip yet — you can still track everyone&apos;s scores
          and continue to review.
        </Alert>
      ) : !isCaptain ? (
        <Alert variant="info" className="mt-6">
          Only the trip captain can set up games for this round.
        </Alert>
      ) : (
        <div className="mt-6">
          <GameTypePicker
            roundId={round.id}
            tripId={tripId}
            isCaptain={isCaptain}
            players={playerOptions}
            monetaryEnabled={MONETARY_GAME_VALUES_ENABLED}
          />
        </div>
      )}

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-forest-900/10 bg-cream-50/95 p-4 backdrop-blur sm:static sm:mt-8 sm:border-0 sm:bg-transparent sm:p-0">
        <div className="mx-auto max-w-2xl">
          <ButtonLink
            href={`/trips/${tripId}/rounds/${round.id}/setup/review`}
            size="lg"
            className="flex w-full justify-center"
          >
            Review Round
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}
