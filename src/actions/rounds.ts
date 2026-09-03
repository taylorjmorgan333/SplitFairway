"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  createRoundSchema,
  addRoundPlayerSchema,
  updateRoundPlayerSchema,
  createRoundGroupSchema,
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
    .select("id, name, city, state")
    .eq("id", courseId)
    .maybeSingle();

  if (!course) {
    return { status: "error", message: "That course couldn't be found." };
  }

  const { data: teeSets } = await supabase
    .from("course_tee_sets")
    .select("id, name")
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

  const teeSetsSnapshot = teeSetRows.map((teeSet) => ({
    name: teeSet.name,
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

export async function deleteRoundGroupAction(groupId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("round_groups").delete().eq("id", groupId);
  if (error) {
    throw new Error("Couldn't remove that group.");
  }
  revalidatePath(`/trips`);
}
