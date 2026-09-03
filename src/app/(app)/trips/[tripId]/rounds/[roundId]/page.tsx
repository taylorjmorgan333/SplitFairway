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
import { CourseTeesDisclosure } from "@/components/rounds/course-tees-disclosure";
import { EditRoundDetailsForm } from "@/components/rounds/edit-round-details-form";
import { SetupStepNav, RoundPhaseTabs } from "@/components/rounds/round-nav";
import { phaseForStatus } from "@/components/rounds/round-phase";
import type { SnapshotTeeSet } from "@/components/rounds/mobile-scorecard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Round" };

const STATUS_BADGE = {
  scheduled: { label: "Scheduled", variant: "gold" as const },
  in_progress: { label: "In progress", variant: "success" as const },
  completed: { label: "Completed", variant: "neutral" as const },
  locked: { label: "Locked", variant: "neutral" as const },
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
  // Nested closures below (PlayersAndGroups) don't retain the
  // notFound()-narrowed type of `round`/`user` from TS's point of view,
  // so re-bind to new consts that carry the narrowed, non-null type.
  const safeRound = round;
  const safeUser = user;

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

  const teeSets = (snapshot?.tee_sets as SnapshotTeeSet[] | null) ?? [];
  const teeSetNames = teeSets.map((t) => t.name);

  const badge = STATUS_BADGE[safeRound.status];
  const myPlayerMembership = memberRows.find((m) => m.user_id === safeUser.id);
  const phase = phaseForStatus(safeRound.status);

  const playerNameList = playerRows.map((p) => ({
    id: p.id,
    displayName: memberById.get(p.trip_member_id)?.display_name ?? "Unknown golfer",
    groupId: p.group_id,
  }));

  const courseName = snapshot?.course_name ?? "Course";
  const courseLocation = snapshot?.course_city
    ? `${snapshot.course_city}${snapshot.course_state ? `, ${snapshot.course_state}` : ""}`
    : null;

  function PlayersAndGroups() {
    return (
      <>
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Playing Groups</CardTitle>
            <CardDescription>Organize golfers into groups and choose where each group starts.</CardDescription>
          </CardHeader>
          <CardContent>
            <RoundGroupsSection roundId={safeRound.id} groups={groupRows} players={playerNameList} canEdit={isCaptain} />
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Players</CardTitle>
            <CardDescription>
              Each golfer&apos;s handicap is captured when they&apos;re added — updating a profile
              handicap later won&apos;t change a golfer already in this round.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {playerRows.length === 0 && <p className="text-sm text-charcoal-500">No golfers added yet.</p>}
            {playerRows.map((player) => {
              const member = memberById.get(player.trip_member_id);
              const isSelf = member?.user_id === safeUser.id;
              return (
                <RoundPlayerRow
                  key={player.id}
                  roundId={safeRound.id}
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
                <AddRoundPlayerForm roundId={safeRound.id} availableMembers={availableMembers} teeSetNames={teeSetNames} />
              </div>
            )}
            {!isCaptain && !myPlayerMembership && (
              <p className="text-xs text-charcoal-400">Only the trip captain can add golfers to this round.</p>
            )}
          </CardContent>
        </Card>
      </>
    );
  }

  // ---- Setup phase: this page IS "Step 2 of 4 -- Players" ----
  if (phase === "setup") {
    return (
      <div className="mx-auto max-w-2xl pb-28">
        <SetupStepNav tripId={tripId} roundId={safeRound.id} currentStep={2} />

        <h1 className="text-2xl">Set Up Players</h1>
        <p className="mt-1 text-sm text-charcoal-500">Choose each golfer&apos;s tees, playing handicap and group.</p>
        <p className="mt-2 text-xs text-charcoal-400">
          {courseName}
          {courseLocation ? ` · ${courseLocation}` : ""} · {formatDate(safeRound.round_date)} · {safeRound.hole_count} holes
        </p>

        <CourseTeesDisclosure teeSets={teeSets} />

        <PlayersAndGroups />

        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-forest-900/10 bg-cream-50/95 p-4 backdrop-blur sm:static sm:mt-8 sm:border-0 sm:bg-transparent sm:p-0">
          <div className="mx-auto max-w-2xl">
            <ButtonLink
              href={`/trips/${tripId}/rounds/${safeRound.id}/setup/games`}
              size="lg"
              className="flex w-full justify-center"
            >
              Save Players &amp; Continue
            </ButtonLink>
            {playerRows.length === 0 && (
              <p className="mt-2 text-center text-xs text-charcoal-400">
                You can add golfers later, but most rounds add at least one before choosing games.
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ---- Play / Finish phases: the round "hub" -- header, persistent
  // Scorecard/Games/Leaderboard/Results nav, then players & groups
  // moved below the fold as "Round Settings" rather than the primary
  // content, since there's nothing left to set up once play has begun. ----
  return (
    <div className="mx-auto max-w-2xl">
      <RoundPhaseTabs
        tripId={tripId}
        roundId={safeRound.id}
        status={safeRound.status}
        sideGamesEnabled={SIDE_GAMES_ENABLED}
        leaderboardEnabled={LIVE_LEADERBOARD_ENABLED}
      />

      <div className="flex flex-wrap items-center gap-2">
        <h1 className="font-serif text-2xl text-forest-900">
          {safeRound.name ? safeRound.name : courseName}
        </h1>
        <Badge variant={badge.variant}>{badge.label}</Badge>
      </div>
      {safeRound.name && (
        <p className="mt-0.5 text-sm text-charcoal-600">
          {courseName}
          {courseLocation ? ` · ${courseLocation}` : ""}
        </p>
      )}
      <p className="mt-1 text-sm text-charcoal-500">
        {formatDate(safeRound.round_date)}
        {safeRound.start_time ? ` · ${safeRound.start_time.slice(0, 5)}` : ""} · {safeRound.hole_count} holes ·{" "}
        {phase === "play" ? "In progress" : "Finished"}
      </p>
      <div className="mt-2">
        <EditRoundDetailsForm
          tripId={tripId}
          roundId={safeRound.id}
          name={safeRound.name}
          roundDate={safeRound.round_date}
          startTime={safeRound.start_time}
          canEditDateTime={false}
        />
      </div>

      <CourseTeesDisclosure teeSets={teeSets} />

      {playerRows.length > 0 && (
        <div className="mt-4">
          <ButtonLink href={`/trips/${tripId}/rounds/${safeRound.id}/score`} size="lg" className="flex w-full justify-center sm:w-auto">
            {phase === "play" ? "Enter Scores" : "View Scorecard"}
          </ButtonLink>
        </div>
      )}

      <div className="mt-10 border-t border-charcoal-400/15 pt-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-charcoal-400">Round Settings</p>
        <p className="mt-1 text-sm text-charcoal-500">
          Players, groups, tees and handicaps can still be adjusted here if something changes.
        </p>
        <PlayersAndGroups />
      </div>

      <div className="mt-8">
        <ButtonLink href={`/trips/${tripId}/rounds`} variant="outline">
          Back to rounds
        </ButtonLink>
      </div>
    </div>
  );
}
