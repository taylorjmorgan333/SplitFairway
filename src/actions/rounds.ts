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
} from "@/lib/validation/round";
import type { ActionState } from "@/actions/auth";
import type { Json } from "@/lib/supabase/database.types";

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

  const { courseId, name, roundDate, startTime, holeCount } = parsed.data;

  const { data: course } = await supabase
    .from("courses")
    .select("id, name, city, state, external_source, external_id")
    .eq("id", courseId)
    .maybeSingle();

  if (!course) {
    return { status: "error", message: "That course couldn't be found." };
  }

  const { data: teeSets } = await supabase
    .from("course_tee_sets")
    .select("id, name, color, category, course_rating, slope_rating, total_yards")
    .eq("course_id", courseId);

  const teeSetRows = teeSets ?? [];
  const { data: holes } =
    teeSetRows.length > 0
      ? await supabase
          .from("course_holes")
          .select("tee_set_id, hole_number, par, yardage, stroke_index")
          .in(
            "tee_set_id",
            teeSetRows.map((t) => t.id),
          )
      : { data: [] };
  const holeRows = holes ?? [];

  // Everything the scorecard, the game engine, and every game-results
  // page read for the life of this round -- see the comment on
  // round_course_snapshots in supabase/migrations/20260903040000_rounds.sql.
  // Rating/slope/color/category are included for display and any future
  // course-handicap conversion; today's scoring/game math only reads
  // par and stroke_index (see src/lib/golf/*.ts), same as before this
  // provider integration -- adding these fields here doesn't change what
  // any existing calculation reads.
  const teeSetsSnapshot = teeSetRows.map((teeSet) => ({
    name: teeSet.name,
    color: teeSet.color,
    category: teeSet.category,
    course_rating: teeSet.course_rating,
    slope_rating: teeSet.slope_rating,
    total_yards: teeSet.total_yards,
    holes: holeRows
      .filter((h) => h.tee_set_id === teeSet.id)
      .sort((a, b) => a.hole_number - b.hole_number)
      .map((h) => ({
        hole_number: h.hole_number,
        par: h.par,
        yardage: h.yardage,
        stroke_index: h.stroke_index,
      })),
  }));

  const { data: round, error: roundError } = await supabase
    .from("rounds")
    .insert({
      trip_id: tripId,
      course_id: courseId,
      name: name || null,
      round_date: roundDate,
      start_time: startTime || null,
      hole_count: holeCount,
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

  const { error: snapshotError } = await supabase.from("round_course_snapshots").insert({
    round_id: round.id,
    course_name: course.name,
    course_city: course.city,
    course_state: course.state,
    hole_count: holeCount,
    tee_sets: teeSetsSnapshot as unknown as Json,
    provider: course.external_source,
    provider_course_id: course.external_id,
  });

  if (snapshotError) {
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

  const resolvedPlayingHandicap = playingHandicap
    ? Number(playingHandicap)
    : profileHandicapIndex;

  const { error } = await supabase.from("round_players").insert({
    round_id: roundId,
    trip_member_id: tripMemberId,
    tee_set_name: teeSetName || null,
    profile_handicap_index: profileHandicapIndex,
    profile_handicap_source: profileHandicapSource,
    profile_handicap_revision_date: profileHandicapRevisionDate,
    playing_handicap: resolvedPlayingHandicap,
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
    groupId: formData.get("groupId"),
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

  const { teeSetName, playingHandicap, groupId } = parsed.data;

  const { error } = await supabase
    .from("round_players")
    .update({
      tee_set_name: teeSetName || null,
      playing_handicap: playingHandicap ? Number(playingHandicap) : null,
      group_id: groupId || null,
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
