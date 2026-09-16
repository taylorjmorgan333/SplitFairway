"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  createRoundSchema,
  addRoundPlayerSchema,
  updateRoundPlayerSchema,
  createRoundGroupSchema,
  updateRoundDetailsSchema,
  addNewGolferToRoundSchema,
} from "@/lib/validation/round";
import type { ActionState } from "@/actions/auth";
import type { Database, Json } from "@/lib/supabase/database.types";
import {
  loadCourseSnapshotInput,
  insertRoundCourseSnapshot,
  computeCourseHandicap,
  mergeMissingTeeRatings,
} from "@/lib/golf/round-snapshot";
import { courseHandicapForTee, findTeeSetByName, type HandicapTeeSet } from "@/lib/golf/handicap";

/**
 * Creates a round and, in the same action, its round_course_snapshots
 * row -- a copy of the chosen course's current tee sets and hole-by-hole
 * par/yardage/stroke-index. That snapshot (not courses/course_tee_sets/
 * course_holes) is what every later phase (score entry, the game
 * engine) reads from, so editing the shared course library after this
 * point never changes a round that already exists. RLS
 * (rounds_insert_captain) restricts this to the trip's captain.
 */
export async function createRoundAction(
  tripId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = createRoundSchema.safeParse({
    courseId: formData.get("courseId"),
    name: formData.get("name"),
    roundDate: formData.get("roundDate"),
    startTime: formData.get("startTime"),
    holeCount: formData.get("holeCount"),
    tournamentId: formData.get("tournamentId"),
    newTournamentName: formData.get("newTournamentName"),
  });

  if (!parsed.success) {
    return { status: "error", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { status: "error", message: "You need to be signed in to schedule a round." };
  }

  const { courseId, name, roundDate, startTime, holeCount, tournamentId, newTournamentName } = parsed.data;

  // A brand-new tournament name wins over picking an existing one --
  // the form only ever shows one of the two inputs at a time (see
  // CreateRoundForm), so this just resolves whichever was actually
  // filled in to a single tournament_id for the round below.
  let resolvedTournamentId: string | null = null;
  if (newTournamentName) {
    const { data: tournament, error: tournamentError } = await supabase
      .from("tournaments")
      .insert({ trip_id: tripId, name: newTournamentName, created_by: user.id })
      .select("id")
      .single();

    if (tournamentError || !tournament) {
      return {
        status: "error",
        message: "Something went wrong creating that tournament. Make sure you're a captain on this trip.",
      };
    }
    resolvedTournamentId = tournament.id;
  } else if (tournamentId) {
    resolvedTournamentId = tournamentId;
  }

  const snapshotInput = await loadCourseSnapshotInput(supabase, courseId);
  if (!snapshotInput.ok) {
    return { status: "error", message: "That course couldn't be found." };
  }

  const { data: round, error: roundError } = await supabase
    .from("rounds")
    .insert({
      trip_id: tripId,
      course_id: courseId,
      name: name || null,
      round_date: roundDate,
      start_time: startTime || null,
      hole_count: holeCount,
      tournament_id: resolvedTournamentId,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (roundError || !round) {
    return {
      status: "error",
      message: "Something went wrong creating the round. Make sure you're a captain on this trip.",
    };
  }

  const snapshotResult = await insertRoundCourseSnapshot(supabase, round.id, holeCount, snapshotInput);

  if (!snapshotResult.ok) {
    // The round row exists but has no snapshot -- surface this rather
    // than silently leaving a broken round behind. The captain can
    // delete it and try again; nothing downstream trusts a round
    // without a snapshot.
    await supabase.from("rounds").delete().eq("id", round.id);
    return {
      status: "error",
      message: "Something went wrong saving the course details for this round. Please try again.",
    };
  }

  revalidatePath(`/trips/${tripId}/rounds`);
  redirect(`/trips/${tripId}/rounds/${round.id}`);
}

export async function deleteRoundAction(tripId: string, roundId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("rounds").delete().eq("id", roundId);
  if (error) {
    throw new Error("Couldn't delete that round.");
  }
  revalidatePath(`/trips/${tripId}/rounds`);
}

/**
 * Adds a golfer (an existing trip_members row -- guest or accountholder)
 * to a round, and snapshots their current golf profile handicap at this
 * exact moment. That snapshot is never rewritten by a later
 * golf_profiles change -- seeing what handicap was actually in effect
 * for this round stays correct even if the golfer updates their profile
 * handicap afterward (the "do not retroactively change completed round
 * results" requirement).
 */
export async function addRoundPlayerAction(
  roundId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = addRoundPlayerSchema.safeParse({
    tripMemberId: formData.get("tripMemberId"),
    teeSetName: formData.get("teeSetName"),
    playingHandicap: formData.get("playingHandicap"),
  });

  if (!parsed.success) {
    return { status: "error", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { status: "error", message: "You need to be signed in to do that." };
  }

  const { tripMemberId, teeSetName, playingHandicap } = parsed.data;

  const { data: member } = await supabase
    .from("trip_members")
    .select("user_id")
    .eq("id", tripMemberId)
    .maybeSingle();

  let profileHandicapIndex: number | null = null;
  let profileHandicapSource: "manual" | "ghin_screenshot_import" | null = null;
  let profileHandicapRevisionDate: string | null = null;

  if (member?.user_id) {
    const { data: golfProfile } = await supabase
      .from("golf_profiles")
      .select("handicap_index, handicap_source, handicap_revision_date")
      .eq("user_id", member.user_id)
      .maybeSingle();

    if (golfProfile) {
      profileHandicapIndex = golfProfile.handicap_index;
      profileHandicapSource = golfProfile.handicap_source;
      profileHandicapRevisionDate = golfProfile.handicap_revision_date;
    }
  }

  // A typed value here is an explicit manual override of the final
  // Playing Handicap; otherwise we calculate a tee-specific Course
  // Handicap from the golfer's Handicap Index and store that as both
  // the Course Handicap and (absent an override) the Playing Handicap.
  // See src/lib/golf/handicap.ts for the single source of truth for
  // this math -- never recompute it independently here.
  const courseHandicap = await computeCourseHandicap(
    supabase,
    roundId,
    teeSetName || null,
    profileHandicapIndex,
  );

  const manualOverride = playingHandicap ? Number(playingHandicap) : null;
  const resolvedPlayingHandicap = manualOverride ?? courseHandicap;
  const playingHandicapSource: Database["public"]["Enums"]["playing_handicap_source"] =
    manualOverride !== null ? "manual" : "calculated";

  const { error } = await supabase.from("round_players").insert({
    round_id: roundId,
    trip_member_id: tripMemberId,
    tee_set_name: teeSetName || null,
    profile_handicap_index: profileHandicapIndex,
    profile_handicap_source: profileHandicapSource,
    profile_handicap_revision_date: profileHandicapRevisionDate,
    course_handicap: courseHandicap,
    playing_handicap: resolvedPlayingHandicap,
    playing_handicap_source: playingHandicapSource,
    handicap_entered_by: user.id,
  });

  if (error) {
    return {
      status: "error",
      message: error.code === "23505" ? "That golfer is already in this round." : "Couldn't add that golfer.",
    };
  }

  revalidatePath(`/trips`);
  return { status: "success", message: "Golfer added." };
}

// roundId isn't used in the query itself (RLS scopes the delete to rows
// the caller may touch regardless), but it's kept as a parameter so
// every round_players action can be bound the same way from the UI —
// see the eslint-disable note on removeGhinNumberAction in
// src/actions/golf.ts for why the whole-signature disable is needed for
// a multi-line parameter list.
/* eslint-disable @typescript-eslint/no-unused-vars */
export async function removeRoundPlayerAction(roundId: string, playerId: string): Promise<void> {
  /* eslint-enable @typescript-eslint/no-unused-vars */
  const supabase = await createClient();
  const { error } = await supabase.from("round_players").delete().eq("id", playerId);
  if (error) {
    throw new Error("Couldn't remove that golfer.");
  }
  revalidatePath(`/trips`);
}

export interface DiscardRoundResult {
  status: "success" | "error";
  message?: string;
}

/**
 * Soft-deletes a round (Home's "Round Options" menu, and the stronger
 * "Delete Round" confirmation on a completed round's Settings page --
 * both call this same action). All the actual authorization --
 * creator-only for a Quick Round, any current trip captain for a
 * Group/Trip Round -- is enforced inside the discard_round() database
 * function itself (supabase/migrations/20260918100000_round_soft_delete.sql),
 * not here, so this action can't be bypassed by calling it directly
 * with a different roundId than the UI shows. Revalidates every page
 * that can display this round so it disappears immediately rather than
 * only after a hard refresh.
 */
export async function discardRoundAction(tripId: string, roundId: string): Promise<DiscardRoundResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("discard_round", { p_round_id: roundId });
  if (error) {
    console.error("discardRoundAction: discard_round RPC failed", { tripId, roundId, error });
    return { status: "error", message: "Couldn't discard this round. Please try again." };
  }
  revalidatePath("/home");
  revalidatePath(`/trips/${tripId}`);
  revalidatePath(`/trips/${tripId}/rounds`);
  revalidatePath(`/trips/${tripId}/rounds/${roundId}`);
  return { status: "success" };
}

/**
 * Undo for discardRoundAction -- the "Round discarded — Undo" toast
 * calls this within its short display window. Same authorization
 * (re-checked independently inside restore_round(), not trusted from
 * the fact that discard just succeeded for this session).
 */
export async function restoreRoundAction(tripId: string, roundId: string): Promise<DiscardRoundResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("restore_round", { p_round_id: roundId });
  if (error) {
    console.error("restoreRoundAction: restore_round RPC failed", { tripId, roundId, error });
    return { status: "error", message: "Couldn't undo — please refresh and try again." };
  }
  revalidatePath("/home");
  revalidatePath(`/trips/${tripId}`);
  revalidatePath(`/trips/${tripId}/rounds`);
  revalidatePath(`/trips/${tripId}/rounds/${roundId}`);
  return { status: "success" };
}

/**
 * Lets either the organizer or the golfer themselves adjust the tee
 * set, group, or playing handicap actually used for a round -- RLS
 * (round_players_update_captain_or_self) is what actually enforces who
 * may call this for which row.
 */
export async function updateRoundPlayerAction(
  roundId: string,
  playerId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = updateRoundPlayerSchema.safeParse({
    teeSetName: formData.get("teeSetName"),
    playingHandicap: formData.get("playingHandicap"),
    handicapSource: formData.get("handicapSource"),
    groupId: formData.get("groupId"),
    teamColor: formData.get("teamColor"),
  });

  if (!parsed.success) {
    return { status: "error", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { status: "error", message: "You need to be signed in to do that." };
  }

  const { teeSetName, playingHandicap, handicapSource, groupId, teamColor } = parsed.data;

  // A tee change must never silently clear a deliberate manual override
  // (see src/lib/golf/handicap.ts) -- so we only recompute the Course
  // Handicap here when the caller explicitly asked for "calculated"
  // (the default when the field is omitted, for older callers). A
  // "manual" request keeps whatever Playing Handicap was typed and
  // still records the Course Handicap informationally so the UI can
  // show both numbers side by side.
  const { data: existingPlayer } = await supabase
    .from("round_players")
    .select("profile_handicap_index")
    .eq("id", playerId)
    .maybeSingle();

  const resolvedTeeSetName = teeSetName || null;
  const courseHandicap = await computeCourseHandicap(
    supabase,
    roundId,
    resolvedTeeSetName,
    existingPlayer?.profile_handicap_index ?? null,
  );

  const wantsManual = handicapSource === "manual";
  const manualValue = playingHandicap ? Number(playingHandicap) : null;

  const resolvedPlayingHandicap = wantsManual ? manualValue : courseHandicap;
  const playingHandicapSource: Database["public"]["Enums"]["playing_handicap_source"] = wantsManual
    ? "manual"
    : "calculated";

  const { error } = await supabase
    .from("round_players")
    .update({
      tee_set_name: resolvedTeeSetName,
      course_handicap: courseHandicap,
      playing_handicap: resolvedPlayingHandicap,
      playing_handicap_source: playingHandicapSource,
      group_id: groupId || null,
      team_color: teamColor || null,
      handicap_entered_by: user.id,
    })
    .eq("id", playerId);

  if (error) {
    return { status: "error", message: "Couldn't save that. Please try again." };
  }

  revalidatePath(`/trips`);
  return { status: "success", message: "Saved." };
}

export async function createRoundGroupAction(
  roundId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = createRoundGroupSchema.safeParse({
    label: formData.get("label"),
    startingHole: formData.get("startingHole"),
  });

  if (!parsed.success) {
    return { status: "error", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("round_groups").insert({
    round_id: roundId,
    label: parsed.data.label,
    starting_hole: parsed.data.startingHole,
  });

  if (error) {
    return { status: "error", message: "Couldn't add that group." };
  }

  revalidatePath(`/trips`);
  return { status: "success", message: "Group added." };
}

/**
 * Lets the organizer fix a wrong par/yardage/stroke-index directly in
 * *this round's own* snapshot -- before the round starts, without
 * waiting on admin review. This intentionally never touches the shared
 * courses/course_tee_sets/course_holes rows (that's what
 * submitCourseCorrectionAction, a separate admin-reviewed path, is for)
 * -- it only fixes what this one round will use. Restricted to
 * status = 'scheduled' so a fix can never retroactively change a round
 * that's already in progress or completed, matching the "immutable once
 * play starts" rule the snapshot exists to enforce in the first place.
 */
export async function updateRoundSnapshotAction(
  roundId: string,
  teeSets: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "You need to be signed in to do that." };
  }

  const { data: round } = await supabase
    .from("rounds")
    .select("id, status, trip_id")
    .eq("id", roundId)
    .maybeSingle();

  if (!round) {
    return { ok: false, error: "That round couldn't be found." };
  }
  if (round.status !== "scheduled") {
    return { ok: false, error: "This round has already started — it can no longer be edited here." };
  }

  const { error } = await supabase
    .from("round_course_snapshots")
    .update({ tee_sets: teeSets as Json })
    .eq("round_id", roundId);

  if (error) {
    return { ok: false, error: "Couldn't save that change. Make sure you're this trip's captain." };
  }

  revalidatePath(`/trips/${round.trip_id}/rounds/${roundId}`);
  return { ok: true };
}

export type RefreshRoundTeeDataResult =
  | { ok: true; updatedTeeNames: string[]; recalculatedPlayerCount: number }
  | { ok: false; error: string };

/**
 * Section 4's "existing in-progress rounds with missing tee Rating/Slope"
 * fallback: lets the trip captain pull this round's own permanent tee
 * snapshot (round_course_snapshots.tee_sets) back into sync with the
 * course library, but ONLY to fill in a Rating/Slope this round never
 * had -- never to correct one it already has, since that could silently
 * change results for a round already under way (see the "Preserve
 * historical accuracy" requirement). Matching is by exact tee name (see
 * mergeMissingTeeRatings) since that's the only identifier this app
 * stores per tee; there is no separate "show a proposed value" preview
 * step because that match is exact, not a fuzzy guess.
 *
 * Gated the same way updateRoundSnapshotAction is (captain-only, via
 * round_course_snapshots_update_captain -- see
 * supabase/migrations/20260918110000_course_handicap_support.sql for
 * why that policy didn't exist before this feature needed it), but
 * allows 'in_progress' as well as 'scheduled': a round already being
 * played is exactly the case this exists for. A completed or locked
 * round is refused outright -- its results are final.
 *
 * After the snapshot itself is patched, recalculates course_handicap /
 * playing_handicap for players on one of the now-fixed tees, but only
 * those who previously had no Course Handicap at all (course_handicap
 * was null) and have never set a manual override -- untouched players
 * and deliberate overrides are left exactly as they were.
 */
export async function refreshRoundTeeDataAction(roundId: string): Promise<RefreshRoundTeeDataResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "You need to be signed in to do that." };
  }

  const { data: round } = await supabase
    .from("rounds")
    .select("id, course_id, status, trip_id")
    .eq("id", roundId)
    .maybeSingle();

  if (!round) {
    return { ok: false, error: "That round couldn't be found." };
  }
  if (!round.course_id) {
    return { ok: false, error: "This round isn't linked to a saved course." };
  }
  if (round.status !== "scheduled" && round.status !== "in_progress") {
    return { ok: false, error: "This round's results are final and can no longer be refreshed." };
  }

  const { data: snapshotRow } = await supabase
    .from("round_course_snapshots")
    .select("tee_sets")
    .eq("round_id", roundId)
    .maybeSingle();

  if (!snapshotRow) {
    return { ok: false, error: "This round has no saved course data to refresh." };
  }

  const freshCourse = await loadCourseSnapshotInput(supabase, round.course_id);
  if (!freshCourse.ok) {
    return { ok: false, error: "Couldn't load the saved course's current tee data." };
  }

  const existingTeeSets = (snapshotRow.tee_sets as HandicapTeeSet[] | null) ?? [];
  const { merged, updatedTeeNames } = mergeMissingTeeRatings(
    existingTeeSets,
    freshCourse.teeSetsSnapshot as HandicapTeeSet[],
  );

  if (updatedTeeNames.length === 0) {
    return { ok: true, updatedTeeNames: [], recalculatedPlayerCount: 0 };
  }

  const { error: snapshotError } = await supabase
    .from("round_course_snapshots")
    .update({ tee_sets: merged as unknown as Json })
    .eq("round_id", roundId);

  if (snapshotError) {
    return { ok: false, error: "Couldn't save the refreshed tee data. Make sure you're this trip's captain." };
  }

  const { data: players } = await supabase
    .from("round_players")
    .select("id, tee_set_name, profile_handicap_index, course_handicap, playing_handicap_source")
    .eq("round_id", roundId);

  let recalculatedPlayerCount = 0;
  for (const player of players ?? []) {
    if (!player.tee_set_name || !updatedTeeNames.includes(player.tee_set_name)) continue;
    if (player.course_handicap != null) continue;
    if (player.playing_handicap_source === "manual") continue;

    const tee = findTeeSetByName(merged, player.tee_set_name);
    const courseHandicap = courseHandicapForTee(player.profile_handicap_index, tee);
    if (courseHandicap == null) continue;

    const { error: playerError } = await supabase
      .from("round_players")
      .update({
        course_handicap: courseHandicap,
        playing_handicap: courseHandicap,
        playing_handicap_source: "calculated",
      })
      .eq("id", player.id);

    if (!playerError) recalculatedPlayerCount++;
  }

  revalidatePath(`/trips/${round.trip_id}/rounds/${roundId}`);
  revalidatePath(`/trips`);
  return { ok: true, updatedTeeNames, recalculatedPlayerCount };
}

export async function deleteRoundGroupAction(groupId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("round_groups").delete().eq("id", groupId);
  if (error) {
    throw new Error("Couldn't remove that group.");
  }
  revalidatePath(`/trips`);
}

/**
 * Lets the captain fix a round's name/date/start time from the "Edit
 * round details" link on the round header, instead of exposing every
 * setting inline. Date and start time only change while the round is
 * still 'scheduled' -- once play has started (or finished), rewriting
 * the date it was actually played would misrepresent the record, so
 * only the display name stays editable at that point (the form hides
 * those fields client-side; this is the server-side backstop).
 */
export async function updateRoundDetailsAction(
  tripId: string,
  roundId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = updateRoundDetailsSchema.safeParse({
    name: formData.get("name"),
    roundDate: formData.get("roundDate"),
    startTime: formData.get("startTime"),
  });

  if (!parsed.success) {
    return { status: "error", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { status: "error", message: "You need to be signed in to do that." };
  }

  const { data: round } = await supabase
    .from("rounds")
    .select("id, status")
    .eq("id", roundId)
    .maybeSingle();

  if (!round) {
    return { status: "error", message: "That round couldn't be found." };
  }

  const { name, roundDate, startTime } = parsed.data;
  const update: { name: string | null; round_date?: string; start_time?: string | null } = {
    name: name || null,
  };
  if (round.status === "scheduled") {
    update.round_date = roundDate;
    update.start_time = startTime || null;
  }

  const { error } = await supabase.from("rounds").update(update).eq("id", roundId);

  if (error) {
    return {
      status: "error",
      message: "Couldn't save those details. Make sure you're this trip's captain.",
    };
  }

  revalidatePath(`/trips/${tripId}/rounds/${roundId}`);
  return { status: "success", message: "Round details saved." };
}

/**
 * The round-page equivalent of "Add a golfer manually" on the trip
 * members page (see addMemberManuallyAction in src/actions/members.ts):
 * for a golfer who isn't a trip member yet and won't go through an
 * email invite, this creates them as an active trip member via the
 * same add_trip_member_manually() RPC (captain-only, rate-limited, no
 * invitation token) and, in the same action, adds them straight into
 * this round -- one button instead of leaving the round to add a trip
 * member and coming back. Since they're brand new, there's no existing
 * golf_profiles row to snapshot a handicap from, so playingHandicap
 * here is whatever the captain typed (or null).
 */
export async function addNewGolferToRoundAction(
  tripId: string,
  roundId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = addNewGolferToRoundSchema.safeParse({
    displayName: formData.get("displayName"),
    email: formData.get("email"),
    teeSetName: formData.get("teeSetName"),
    playingHandicap: formData.get("playingHandicap"),
  });

  if (!parsed.success) {
    return { status: "error", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { status: "error", message: "You need to be signed in to do that." };
  }

  const { displayName, email, teeSetName, playingHandicap } = parsed.data;

  const { data: rpcResult, error: memberError } = await supabase.rpc("add_trip_member_manually", {
    p_trip_id: tripId,
    p_display_name: displayName,
    p_email: email ? email : undefined,
  });

  if (memberError) {
    return { status: "error", message: memberError.message };
  }

  const tripMemberId = (rpcResult as { trip_member_id?: string } | null)?.trip_member_id;
  if (!tripMemberId) {
    return { status: "error", message: "Something went wrong adding that golfer. Please try again." };
  }

  // This golfer has no account and so no golf_profiles row to snapshot
  // a Handicap Index from -- the "Playing handicap" field on this form
  // is the closest equivalent, so we treat whatever the organizer typed
  // here as that golfer's Handicap Index for this round (stored in
  // profile_handicap_index for consistent snapshot semantics with every
  // other round_players row) and calculate a tee-specific Course
  // Handicap from it exactly as we would for an invited golfer. If no
  // tee is selected yet, or the tee is missing Rating/Slope, fall back
  // to using the typed number directly as the Playing Handicap, marked
  // manual (see src/lib/golf/handicap.ts for why we never guess).
  const resolvedTeeSetName = teeSetName || null;
  const enteredHandicapIndex = playingHandicap ? Number(playingHandicap) : null;
  const courseHandicap = await computeCourseHandicap(
    supabase,
    roundId,
    resolvedTeeSetName,
    enteredHandicapIndex,
  );

  const resolvedPlayingHandicap = courseHandicap ?? enteredHandicapIndex;
  const playingHandicapSource: Database["public"]["Enums"]["playing_handicap_source"] =
    courseHandicap !== null ? "calculated" : "manual";

  const { error: playerError } = await supabase.from("round_players").insert({
    round_id: roundId,
    trip_member_id: tripMemberId,
    tee_set_name: resolvedTeeSetName,
    profile_handicap_index: enteredHandicapIndex,
    profile_handicap_source: enteredHandicapIndex !== null ? "manual" : null,
    course_handicap: courseHandicap,
    playing_handicap: resolvedPlayingHandicap,
    playing_handicap_source: playingHandicapSource,
    handicap_entered_by: user.id,
  });

  if (playerError) {
    // The trip member was created even though adding them to this round
    // failed -- surface that plainly rather than a generic error, since
    // "Add a new golfer" already succeeded from the captain's point of
    // view and they're now findable on the trip's members list.
    return {
      status: "error",
      message: `${displayName} was added to the trip, but couldn't be added to this round. Add them from the golfer list above.`,
    };
  }

  revalidatePath(`/trips`);
  return { status: "success", message: `${displayName} was added to the trip and to this round.` };
}
