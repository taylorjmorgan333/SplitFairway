"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { startQuickRoundSchema } from "@/lib/validation/quick-round";
import { courseSchema } from "@/lib/validation/course";
import { loadCourseSnapshotInput, insertRoundCourseSnapshot } from "@/lib/golf/round-snapshot";
import { addRoundPlayerAction } from "@/actions/rounds";
import { startRoundAction } from "@/actions/scores";
import type { ActionState } from "@/actions/auth";
import { GAME_TYPE_LABELS } from "@/lib/validation/group";

export type CreateQuickCourseResult =
  | { ok: true; courseId: string; name: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[] | undefined> };

/**
 * The Quick Round course picker's "Manual Course" path (spec addendum:
 * "If the course cannot be found, show 'Can't find your course? Add it
 * manually.' ... Do not send users to a separate Courses page during
 * Quick Round setup."). Same validation and the exact same courses
 * insert as createCourseAction (src/actions/courses.ts) -- same
 * created_by/status('pending')-by-omission shape, so a manually-added
 * course here shows up in the shared course library exactly like one
 * added from /courses/new -- but this returns the new course id
 * instead of redirecting to /courses/[id], so the picker can select it
 * in place without ever leaving Quick Round setup. A course added this
 * way starts with no tee sets (same as any freshly manually-added
 * course); round-snapshot.ts already treats that as a normal, supported
 * state (an empty tee_sets snapshot), so the round still starts fine.
 */
export async function createQuickCourseAction(formData: FormData): Promise<CreateQuickCourseResult> {
  const parsed = courseSchema.safeParse({
    name: formData.get("name"),
    city: formData.get("city"),
    state: formData.get("state"),
    holeCount: formData.get("holeCount"),
  });

  if (!parsed.success) {
    return { ok: false, error: "Check the course details below.", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "You need to be signed in." };
  }

  const { data, error } = await supabase
    .from("courses")
    .insert({
      created_by: user.id,
      name: parsed.data.name,
      city: parsed.data.city || null,
      state: parsed.data.state || null,
      hole_count: parsed.data.holeCount,
    })
    .select("id, name")
    .single();

  if (error || !data) {
    return { ok: false, error: "Something went wrong creating the course." };
  }

  return { ok: true, courseId: data.id, name: data.name };
}

/**
 * The single server action behind the Quick Round single-screen setup
 * (spec: "Replace it with one mobile-first setup screen ... One large
 * sticky button: Start Scoring. No separate Review step."). Modeled
 * directly on startFastGroupRoundAction (group-rounds.ts) -- same
 * reused pieces (loadCourseSnapshotInput/insertRoundCourseSnapshot,
 * addRoundPlayerAction per golfer, a direct side_games insert for the
 * optional game, startRoundAction, rollback-by-deleting-the-trip on
 * partial failure) -- but starts from start_quick_round_trip() instead
 * of start_group_round_trip(), since a Quick Round has no saved group
 * roster: every non-self golfer is a brand-new trip member, created
 * here via add_trip_member_manually the same way "Add a new golfer"
 * already works on any other round.
 *
 * Nothing about how a golfer's handicap or tee is resolved changes --
 * addRoundPlayerAction is called completely unmodified, so a missing
 * handicap falls back to gross scoring exactly as it already does
 * everywhere else in this app (spec item: "A missing handicap should
 * not block the round").
 */
export async function startQuickRoundSetupAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = startQuickRoundSchema.safeParse({
    courseId: formData.get("courseId"),
    holeCount: formData.get("holeCount"),
    roundName: formData.get("roundName") ?? "",
    roundDate: formData.get("roundDate"),
    startTime: formData.get("startTime") ?? "",
    players: formData.get("players"),
    gameType: formData.get("gameType") ?? "",
  });

  if (!parsed.success) {
    return { status: "error", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { status: "error", message: "You need to be signed in to start a round." };
  }

  const { courseId, holeCount, roundName, roundDate, startTime, players, gameType } = parsed.data;

  const { data: trip, error: tripError } = await supabase.rpc("start_quick_round_trip");
  if (tripError || !trip) {
    console.error("startQuickRoundSetupAction: start_quick_round_trip failed", tripError);
    return { status: "error", message: "Something went wrong starting your round. Please try again." };
  }

  async function rollBackTrip() {
    await supabase.from("trips").delete().eq("id", trip!.id);
  }

  const { data: myTripMember } = await supabase
    .from("trip_members")
    .select("id")
    .eq("trip_id", trip.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!myTripMember) {
    console.error("startQuickRoundSetupAction: no trip_members row for the captain right after create_hosted_round_trip", {
      tripId: trip.id,
      userId: user.id,
    });
    await rollBackTrip();
    return { status: "error", message: "Something went wrong starting your round. Please try again." };
  }

  const snapshotInput = await loadCourseSnapshotInput(supabase, courseId);
  if (!snapshotInput.ok) {
    console.error("startQuickRoundSetupAction: loadCourseSnapshotInput failed", { courseId });
    await rollBackTrip();
    return { status: "error", message: "That course couldn't be found. Please choose another." };
  }

  const { data: round, error: roundError } = await supabase
    .from("rounds")
    .insert({
      trip_id: trip.id,
      course_id: courseId,
      name: roundName || null,
      round_date: roundDate,
      start_time: startTime || null,
      hole_count: holeCount,
      tournament_id: null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (roundError || !round) {
    console.error("startQuickRoundSetupAction: rounds insert failed", roundError);
    await rollBackTrip();
    return { status: "error", message: "Something went wrong creating the round. Please try again." };
  }

  const snapshotResult = await insertRoundCourseSnapshot(supabase, round.id, holeCount, snapshotInput);
  if (!snapshotResult.ok) {
    console.error("startQuickRoundSetupAction: insertRoundCourseSnapshot failed", { roundId: round.id });
    await supabase.from("rounds").delete().eq("id", round.id);
    await rollBackTrip();
    return { status: "error", message: "Something went wrong saving the course details. Please try again." };
  }

  // One addRoundPlayerAction call per golfer -- the signed-in golfer
  // reuses their own trip_member (already created by
  // start_quick_round_trip -> create_hosted_round_trip); every
  // "Add Golfer" entry gets a brand-new trip_member first, exactly like
  // addNewGolferToRoundAction already does for any other round.
  //
  // All-or-nothing: a Quick Round with only some of the requested
  // golfers actually seated is worse than no round at all (the captain
  // asked for a specific roster), so a single failure here rolls back
  // the whole round + hidden trip, the same as a course/snapshot
  // failure above -- never a partially-built round left behind.
  //
  // addRoundPlayerSchema (validation/round.ts) only accepts `""` or
  // `undefined` for its optional fields, never a bare `null` -- and
  // FormData.get() returns `null` (not `undefined`) for a key that was
  // never set(). teeSetName/playingHandicap must always be set here,
  // even to an empty string, or a blank optional field (very common --
  // it's exactly what "gross scoring, no handicap on file" looks like)
  // fails validation and silently reads to the caller as a generic
  // "couldn't add any golfers" with no indication why.
  for (const p of players) {
    let tripMemberId: string | undefined;
    if (p.kind === "self") {
      tripMemberId = myTripMember.id;
    } else {
      const { data: memberResult, error: memberError } = await supabase.rpc("add_trip_member_manually", {
        p_trip_id: trip.id,
        p_display_name: p.displayName,
      });
      if (memberError) {
        console.error("startQuickRoundSetupAction: add_trip_member_manually failed", {
          displayName: p.displayName,
          error: memberError,
        });
      } else {
        tripMemberId = (memberResult as { trip_member_id?: string } | null)?.trip_member_id;
      }
    }

    if (!tripMemberId) {
      console.error("startQuickRoundSetupAction: no trip_member_id resolved for player, rolling back", {
        kind: p.kind,
        displayName: p.displayName,
      });
      await supabase.from("rounds").delete().eq("id", round.id);
      await rollBackTrip();
      return {
        status: "error",
        message: `Couldn't add ${p.kind === "self" ? "you" : p.displayName} to this round. Please try again.`,
      };
    }

    const fd = new FormData();
    fd.set("tripMemberId", tripMemberId);
    fd.set("teeSetName", p.teeSetName ?? "");
    fd.set("playingHandicap", p.playingHandicap ?? "");
    const addResult = await addRoundPlayerAction(round.id, { status: "idle" }, fd);
    if (addResult.status !== "success") {
      console.error("startQuickRoundSetupAction: addRoundPlayerAction failed, rolling back", {
        kind: p.kind,
        displayName: p.displayName,
        tripMemberId,
        addResultMessage: addResult.message,
        addResultFieldErrors: addResult.fieldErrors,
      });
      await supabase.from("rounds").delete().eq("id", round.id);
      await rollBackTrip();
      return {
        status: "error",
        message: `Couldn't add ${p.kind === "self" ? "you" : p.displayName} to this round. Please try again.`,
      };
    }
  }

  // The optional "Game" row (spec item 4): at most one of the four
  // no-saved-lineup formats, applied as a direct side_games +
  // side_game_participants insert -- same shape
  // createSkinsGameAction/createNassauGameAction/etc. (side-games.ts)
  // already use, and the exact pattern startFastGroupRoundAction
  // already applies for a chosen group preset. Defaults to a plain,
  // non-monetary, net-scored game; every setting stays editable from
  // the round's own Games step afterward, same as any other game.
  if (gameType) {
    const { data: roundPlayerRows } = await supabase.from("round_players").select("id").eq("round_id", round.id);
    const roundPlayerIds = (roundPlayerRows ?? []).map((rp) => rp.id);
    const twoSided = gameType === "nassau" || gameType === "match_play";

    if (!twoSided || roundPlayerIds.length >= 2) {
      const { data: game } = await supabase
        .from("side_games")
        .insert({
          round_id: round.id,
          game_type: gameType,
          name: GAME_TYPE_LABELS[gameType],
          scoring_metric: "net",
          carryover: false,
          is_monetary: false,
          dollar_value: null,
          created_by: user.id,
        })
        .select("id")
        .single();

      if (game) {
        if (twoSided) {
          const mid = Math.ceil(roundPlayerIds.length / 2);
          await supabase.from("side_game_participants").insert([
            ...roundPlayerIds.slice(0, mid).map((id) => ({ side_game_id: game.id, round_player_id: id, side: 1 })),
            ...roundPlayerIds.slice(mid).map((id) => ({ side_game_id: game.id, round_player_id: id, side: 2 })),
          ]);
        } else {
          await supabase
            .from("side_game_participants")
            .insert(roundPlayerIds.map((id) => ({ side_game_id: game.id, round_player_id: id, side: null })));
        }
      }
    }
  }

  await startRoundAction(trip.id, round.id);

  revalidatePath("/play");
  revalidatePath(`/trips/${trip.id}`);
  redirect(`/trips/${trip.id}/rounds/${round.id}/score`);
}
