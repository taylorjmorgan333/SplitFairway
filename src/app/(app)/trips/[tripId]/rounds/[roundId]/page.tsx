import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GOLF_SCORING_ENABLED, LIVE_LEADERBOARD_ENABLED, SIDE_GAMES_ENABLED } from "@/lib/config";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { RoundGroupsSection } from "@/components/rounds/round-groups-section";
import { AddRoundPlayerForm } from "@/components/rounds/add-round-player-form";
import { RoundPlayerRow } from "@/components/rounds/round-player-row";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Round" };

const STATUS_BADGE = {
  scheduled: { label: "Scheduled", variant: "gold" as const },
  in_progress: { label: "In progress", variant: "success" as const },
  completed: { label: "Completed", variant: "neutral" as const },
  locked: { label: "Locked", variant: "neutral" as const },
};

type SnapshotTeeSet = {
  name: string;
  holes: { hole_number: number; par: number; yardage: number | null; stroke_index: number | null }[];
};

export default async function RoundDetailPage({
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

  const [{ data: groups }, { data: players }, { data: activeMembers }] = await Promise.all([
    supabase.from("round_groups").select("*").eq("round_id", roundId).order("sort_order"),
    supabase.from("round_players").select("*").eq("round_id", roundId).order("created_at"),
    supabase
      .from("trip_members")
      .select("id, display_name, user_id")
      .eq("trip_id", tripId)
      .eq("status", "active")
      .order("display_name"),
  ]);

  const groupRows = groups ?? [];
  const playerRows = players ?? [];
  const memberRows = activeMembers ?? [];
  const memberById = new Map(memberRows.map((m) => [m.id, m]));

  const takenMemberIds = new Set(playerRows.map((p) => p.trip_member_id));
  const availableMembers = memberRows.filter((m) => !takenMemberIds.has(m.id));

  const teeSets = ((snapshot?.tee_sets as SnapshotTeeSet[] | null) ?? []);
  const teeSetNames = teeSets.map((t) => t.name);

  const badge = STATUS_BADGE[round.status];
  const myPlayerMembership = memberRows.find((m) => m.user_id === user.id);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl">{round.name || formatDate(round.round_date)}</h1>
        <Badge variant={badge.variant}>{badge.label}</Badge>
      </div>
      <p className="mt-1.5 text-sm text-charcoal-500">
        {snapshot?.course_name ?? "Course"}
        {snapshot?.course_city ? ` · ${snapshot.course_city}${snapshot.course_state ? `, ${snapshot.course_state}` : ""}` : ""}
        {" · "}
        {formatDate(round.round_date)}
        {round.start_time ? ` · ${round.start_time.slice(0, 5)}` : ""}
        {" · "}
        {round.hole_count} holes
      </p>

      {playerRows.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          <ButtonLink href={`/trips/${tripId}/rounds/${round.id}/score`} variant="primary" size="sm">
            Enter scores
          </ButtonLink>
          {LIVE_LEADERBOARD_ENABLED && (
            <ButtonLink href={`/trips/${tripId}/rounds/${round.id}/leaderboard`} variant="outline" size="sm">
              Leaderboard
            </ButtonLink>
          )}
          {SIDE_GAMES_ENABLED && (
            <ButtonLink href={`/trips/${tripId}/rounds/${round.id}/games`} variant="outline" size="sm">
              Games
            </ButtonLink>
          )}
        </div>
      )}

      {teeSets.length > 0 && (
        <p className="mt-1.5 text-xs text-charcoal-400">
          Tees: {teeSetNames.join(", ")} — copied from the course library when this round was
          created; later course edits won&apos;t change this round.
        </p>
      )}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Groups</CardTitle>
          <CardDescription>Split golfers into foursomes with their own starting hole.</CardDescription>
        </CardHeader>
        <CardContent>
          <RoundGroupsSection roundId={round.id} groups={groupRows} canEdit={isCaptain} />
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Golfers</CardTitle>
          <CardDescription>
            Each golfer&apos;s handicap is captured when they&apos;re added — updating a profile
            handicap later won&apos;t change a golfer already in this round.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {playerRows.length === 0 && <p className="text-sm text-charcoal-400">No golfers added yet.</p>}
          {playerRows.map((player) => {
            const member = memberById.get(player.trip_member_id);
            const isSelf = member?.user_id === user.id;
            return (
              <RoundPlayerRow
                key={player.id}
                roundId={round.id}
                player={player}
                displayName={member?.display_name ?? "Unknown golfer"}
                teeSetNames={teeSetNames}
                groups={groupRows}
                canEdit={isCaptain || isSelf}
                canRemove={isCaptain}
              />
            );
          })}

          {isCaptain && (
            <div className="border-t border-charcoal-400/10 pt-4">
              <AddRoundPlayerForm
                roundId={round.id}
                availableMembers={availableMembers}
                teeSetNames={teeSetNames}
              />
            </div>
          )}
          {!isCaptain && !myPlayerMembership && (
            <p className="text-xs text-charcoal-400">
              Only the trip captain can add golfers to this round.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="mt-8">
        <ButtonLink href={`/trips/${tripId}/rounds`} variant="outline">
          Back to rounds
        </ButtonLink>
      </div>
    </div>
  );
}
