import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GOLF_SCORING_ENABLED, SIDE_GAMES_ENABLED, NINETEENTH_HOLE_ENABLED, GUEST_SCORING_ENABLED } from "@/lib/config";
import { InviteGuestForm } from "@/components/rounds/invite-guest-form";
import { GuestInvitationsList, type GuestInvitationRow } from "@/components/rounds/guest-invitations-list";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { RoundGroupsSection } from "@/components/rounds/round-groups-section";
import { AddRoundPlayerForm } from "@/components/rounds/add-round-player-form";
import { RoundPlayerRow } from "@/components/rounds/round-player-row";
import { CourseTeesDisclosure } from "@/components/rounds/course-tees-disclosure";
import { RefreshRoundTeeDataButton } from "@/components/rounds/refresh-round-tee-data-button";
import { EditRoundDetailsForm } from "@/components/rounds/edit-round-details-form";
import { DeleteRoundButton } from "@/components/rounds/delete-round-button";
import { SetupStepNav, RoundPhaseTabs } from "@/components/rounds/round-nav";
import { phaseForStatus, isScoringComplete } from "@/components/rounds/round-phase";
import { canDiscardRound, type RoundHostTripKind } from "@/lib/golf/round-discard-permission";
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

  const [{ data: round }, { data: snapshot }, { data: myMembership }, { data: tripRow }] = await Promise.all([
    supabase.from("rounds").select("*").eq("id", roundId).maybeSingle(),
    supabase.from("round_course_snapshots").select("*").eq("round_id", roundId).maybeSingle(),
    supabase
      .from("trip_members")
      .select("role, status")
      .eq("trip_id", tripId)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase.from("trips").select("golf_group_id, kind").eq("id", tripId).maybeSingle(),
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
  // Same rule discard_round()/restore_round() enforce authoritatively
  // in the database: a Quick Round only by its creator, a Group/Trip
  // Round by any current captain. Gates the "Delete Round" control
  // below (item 4/5 of the round-discard spec) -- this is UI-only
  // gating, not the real authorization.
  const canManageRound = canDiscardRound({
    tripKind: (tripRow?.kind ?? "trip") as RoundHostTripKind,
    roundCreatedBy: safeRound.created_by,
    currentUserId: safeUser.id,
    isCaptain,
  });

  let guestInvitations: GuestInvitationRow[] = [];
  if (isCaptain && GUEST_SCORING_ENABLED) {
    const { data: guestInvitationRows } = await supabase
      .from("golf_group_guest_invitations")
      .select("id, guest_display_name, status, expires_at")
      .eq("round_id", roundId)
      .neq("status", "revoked")
      .order("created_at", { ascending: false });
    guestInvitations = (guestInvitationRows ?? []).map((inv) => ({
      id: inv.id,
      guestDisplayName: inv.guest_display_name,
      status: inv.status,
      expiresAt: inv.expires_at,
    }));
  }

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

  const roundPlayerIds = playerRows.map((p) => p.id);
  const { data: scoreRows } =
    roundPlayerIds.length > 0
      ? await supabase.from("hole_scores").select("hole_number, gross_strokes").in("round_player_id", roundPlayerIds)
      : { data: [] };
  const scoresComplete = isScoringComplete(safeRound.hole_count, playerRows.length, scoreRows ?? []);

  const takenMemberIds = new Set(playerRows.map((p) => p.trip_member_id));
  const availableMembers = memberRows.filter((m) => !takenMemberIds.has(m.id));

  const teeSets = (snapshot?.tee_sets as SnapshotTeeSet[] | null) ?? [];
  // Only offer the "refresh missing tee data" fallback (spec section 4)
  // while there's actually something to fix, the round is still
  // scheduled/in_progress (refreshRoundTeeDataAction refuses otherwise),
  // and the round is linked to a saved course to refresh from.
  const hasMissingTeeRatings = teeSets.some((t) => t.course_rating == null || t.slope_rating == null);
  const canRefreshTeeData =
    isCaptain &&
    Boolean(safeRound.course_id) &&
    (safeRound.status === "scheduled" || safeRound.status === "in_progress") &&
    hasMissingTeeRatings;

  const phase = phaseForStatus(safeRound.status);
  const badge =
    phase === "play" && scoresComplete
      ? { label: "Scores Complete", variant: "success" as const }
      : STATUS_BADGE[safeRound.status];
  const myPlayerMembership = memberRows.find((m) => m.user_id === safeUser.id);

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
                  teeSets={teeSets}
                  groups={groupRows}
                  canEdit={isCaptain || isSelf}
                  canRemove={isCaptain}
                />
              );
            })}

            {isCaptain && (
              <div className="border-t border-charcoal-400/10 pt-4">
                <AddRoundPlayerForm tripId={tripId} roundId={safeRound.id} availableMembers={availableMembers} teeSets={teeSets} />
              </div>
            )}
            {!isCaptain && !myPlayerMembership && (
              <p className="text-xs text-charcoal-400">Only the trip captain can add golfers to this round.</p>
            )}
          </CardContent>
        </Card>

        {isCaptain && GUEST_SCORING_ENABLED && safeRound.status !== "locked" && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Invite a Guest to Score</CardTitle>
              <CardDescription>
                A one-tap link for a golfer with no SplitFairway account -- no password, straight to
                this round&apos;s scorecard.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <GuestInvitationsList tripId={tripId} roundId={safeRound.id} invitations={guestInvitations} />
              <InviteGuestForm tripId={tripId} roundId={safeRound.id} groupId={tripRow?.golf_group_id ?? null} />
            </CardContent>
          </Card>
        )}
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
        {canRefreshTeeData && <RefreshRoundTeeDataButton roundId={safeRound.id} />}

        <PlayersAndGroups />

        {/* Sits just above the mobile tab bar (app-shell.tsx: fixed,
            bottom-0, z-40, hidden at md+) instead of at bottom-0 itself --
            both are fixed to the same edge on a phone, and the tab bar's
            higher z-index was rendering directly over this bar, hiding the
            primary action entirely with no way to advance the wizard.
          Raised past 3.5rem to 9rem for the same reason a second time --
          FeedbackButton (layout.tsx, rendered site-wide, z-50) floats
          from 4.75rem to 7.75rem above the tab bar, which this bar's
          old offset sat squarely inside of. 9rem clears its top edge
          with room to spare. */}
        <div className="fixed inset-x-0 bottom-[calc(9rem+env(safe-area-inset-bottom))] z-30 border-t border-forest-900/10 bg-cream-50/95 p-4 backdrop-blur md:static md:bottom-auto md:mt-8 md:border-0 md:bg-transparent md:p-0">
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
    <div className="mx-auto max-w-2xl md:max-w-content">
      <RoundPhaseTabs
        tripId={tripId}
        roundId={safeRound.id}
        status={safeRound.status}
        sideGamesEnabled={SIDE_GAMES_ENABLED}
        nineteenthHoleEnabled={NINETEENTH_HOLE_ENABLED}
        scoresComplete={scoresComplete}
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
        {phase === "play" ? (scoresComplete ? "Scores Complete" : "In progress") : "Finished"}
      </p>
      <div className="mt-2" id="round-settings">
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
      {canRefreshTeeData && <RefreshRoundTeeDataButton roundId={safeRound.id} />}

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

        {(safeRound.status === "completed" || safeRound.status === "locked") && canManageRound && (
          <div className="mt-6 border-t border-charcoal-400/15 pt-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-charcoal-400">Danger Zone</p>
            <div className="mt-3">
              <DeleteRoundButton tripId={tripId} roundId={safeRound.id} />
            </div>
          </div>
        )}
      </div>

      <div className="mt-8">
        <ButtonLink href={`/trips/${tripId}/rounds`} variant="outline">
          Back to rounds
        </ButtonLink>
      </div>
    </div>
  );
}
