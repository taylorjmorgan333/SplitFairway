import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GOLF_SCORING_ENABLED, SIDE_GAMES_ENABLED } from "@/lib/config";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { formatDate } from "@/lib/utils";
import { SetupStepNav } from "@/components/rounds/round-nav";
import { StartRoundButton } from "@/components/rounds/start-round-button";
import type { SnapshotTeeSet } from "@/components/rounds/mobile-scorecard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Ready to Play?" };

export default async function SetupReviewPage({
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

  const [{ data: playerRows }, { data: groupRows }] = await Promise.all([
    supabase
      .from("round_players")
      .select("id, tee_set_name, playing_handicap, group_id, trip_members(display_name)")
      .eq("round_id", roundId)
      .order("created_at"),
    supabase.from("round_groups").select("*").eq("round_id", roundId).order("sort_order"),
  ]);

  const groups = groupRows ?? [];
  const groupById = new Map(groups.map((g) => [g.id, g]));

  const players = (playerRows ?? []).map((p) => {
    const member = Array.isArray(p.trip_members) ? p.trip_members[0] : p.trip_members;
    return {
      id: p.id,
      displayName: member?.display_name ?? "Unknown golfer",
      teeSetName: p.tee_set_name,
      playingHandicap: p.playing_handicap,
      groupLabel: p.group_id ? (groupById.get(p.group_id)?.label ?? null) : null,
    };
  });

  const teeSets = (snapshot?.tee_sets as SnapshotTeeSet[] | null) ?? [];
  const selectedTeeNames = Array.from(new Set(players.map((p) => p.teeSetName).filter((n): n is string => !!n)));

  const warnings: string[] = [];
  if (players.length === 0) {
    warnings.push("Add at least one golfer before starting this round.");
  }
  const missingTees = players.filter((p) => !p.teeSetName).length;
  if (missingTees > 0) {
    warnings.push(`${missingTees} ${missingTees === 1 ? "golfer doesn't" : "golfers don't"} have a tee selected yet.`);
  }
  const missingHandicap = players.filter((p) => p.playingHandicap == null).length;
  if (missingHandicap > 0) {
    warnings.push(
      `${missingHandicap} ${missingHandicap === 1 ? "golfer doesn't" : "golfers don't"} have a playing handicap set.`,
    );
  }
  if (groups.length > 0) {
    const unassigned = players.filter((p) => !p.groupLabel).length;
    if (unassigned > 0) {
      warnings.push(`${unassigned} ${unassigned === 1 ? "golfer isn't" : "golfers aren't"} assigned to a playing group.`);
    }
  }

  const canStart = isCaptain && players.length > 0;

  return (
    <div className="mx-auto max-w-2xl pb-28">
      <SetupStepNav tripId={tripId} roundId={round.id} currentStep={4} />

      <h1 className="text-2xl">Ready to Play?</h1>
      <p className="mt-1 text-sm text-charcoal-500">Review everything below, then start the round.</p>

      {warnings.length > 0 && (
        <div className="mt-4 space-y-2">
          {warnings.map((w) => (
            <Alert key={w} variant="info">
              {w}
            </Alert>
          ))}
        </div>
      )}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Course</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm text-charcoal-700">
          <p>
            <span className="font-medium text-forest-900">Course:</span> {snapshot?.course_name ?? "Not set"}
          </p>
          <p>
            <span className="font-medium text-forest-900">Date:</span> {formatDate(round.round_date)}
            {round.start_time ? ` · ${round.start_time.slice(0, 5)}` : ""}
          </p>
          <p>
            <span className="font-medium text-forest-900">Holes:</span> {round.hole_count}
          </p>
          <p>
            <span className="font-medium text-forest-900">Selected tees:</span>{" "}
            {selectedTeeNames.length > 0 ? selectedTeeNames.join(", ") : teeSets.length > 0 ? "Not chosen yet" : "—"}
          </p>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Players</CardTitle>
        </CardHeader>
        <CardContent>
          {players.length === 0 ? (
            <p className="text-sm text-charcoal-500">No golfers added yet.</p>
          ) : (
            <ul className="divide-y divide-charcoal-400/10">
              {players.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                  <span className="font-medium text-charcoal-800">{p.displayName}</span>
                  <span className="text-charcoal-500">
                    {p.teeSetName ?? "No tee"} · Playing handicap {p.playingHandicap ?? "not set"} ·{" "}
                    {p.groupLabel ?? "No group"}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <ButtonLink
            href={`/trips/${tripId}/rounds/${roundId}`}
            variant="ghost"
            size="sm"
            className="mt-3"
          >
            Edit players &amp; groups
          </ButtonLink>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Games</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-charcoal-500">
            {SIDE_GAMES_ENABLED
              ? "Games you've added are ready to go. You can add, edit or remove games any time on the Games step."
              : "Games aren't turned on for this trip yet — you can still track everyone's scores."}
          </p>
          <ButtonLink href={`/trips/${tripId}/rounds/${roundId}/setup/games`} variant="ghost" size="sm" className="mt-3">
            Edit games
          </ButtonLink>
        </CardContent>
      </Card>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-forest-900/10 bg-cream-50/95 p-4 backdrop-blur sm:static sm:mt-8 sm:border-0 sm:bg-transparent sm:p-0">
        <div className="mx-auto max-w-2xl space-y-2">
          {isCaptain ? (
            <StartRoundButton tripId={tripId} roundId={round.id} disabled={!canStart} />
          ) : (
            <Alert variant="info">Only the trip captain can start this round.</Alert>
          )}
          <ButtonLink
            href={`/trips/${tripId}/rounds`}
            variant="outline"
            size="lg"
            className="flex w-full justify-center"
          >
            Save and Finish Later
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}
