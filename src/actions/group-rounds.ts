"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { startFastGroupRoundSchema } from "@/lib/validation/group";
import { loadCourseSnapshotInput, insertRoundCourseSnapshot } from "@/lib/golf/round-snapshot";
import { addRoundPlayerAction } from "@/actions/rounds";
import { startRoundAction } from "@/actions/scores";
import type { ActionState } from "@/actions/auth";
import type { Database } from "@/lib/supabase/database.types";

type PresetSettings = {
  scoringMetric?: "gross" | "net";
  carryover?: boolean;
  isMonetary?: boolean;
  dollarValue?: number | null;
};

/**
 * The single server action behind the fast Group Round start wizard
 * (spec item 2: "make starting a Group Round extremely fast" -- roster,
 * handicaps, tees, and a saved game preset all remembered, "start round"
 * completable in about three taps once the golfer's chosen who's
 * playing). Reuses, rather than re-implements, every piece this needs:
 * start_group_round_trip (uuid, uuid[]) for the hidden trip + roster,
 * loadCourseSnapshotInput/insertRoundCourseSnapshot for the round's
 * course snapshot (round-snapshot.ts, shared with createRoundAction),
 * addRoundPlayerAction for each round_players insert (so a fast-started
 * round's handicap snapshot works exactly like a normal one), and
 * startRoundAction to move straight into in_progress -- skipping the
 * older separate setup/games + setup/review steps, since this wizard's
 * own final-summary screen already showed the same information before
 * submitting.
 */
export async function startFastGroupRoundAction(
  groupId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = startFastGroupRoundSchema.safeParse({
    courseId: formData.get("courseId"),
    players: formData.get("players"),
    presetId: formData.get("presetId") ?? "",
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

  const { courseId, players, presetId } = parsed.data;

  const { data: myGroupMember } = await supabase
    .from("golf_group_members")
    .select("id")
    .eq("group_id", groupId)
    .eq("user_id", user.id)
    .maybeSingle();

  const otherMemberIds = players.map((p) => p.memberId).filter((id) => id !== myGroupMember?.id);

  const { data: startResult, error: startError } = await supabase.rpc("start_group_round_trip", {
    p_group_id: groupId,
    p_member_ids: otherMemberIds,
  });

  if (startError || !startResult) {
    return { status: "error", message: "Couldn't start a round for this group. Make sure you're a member." };
  }

  const result = startResult as unknown as { trip: Database["public"]["Tables"]["trips"]["Row"]; member_map: Record<string, string> };
  const trip = result.trip;
  const memberMap = result.member_map ?? {};

  const { data: myTripMember } = await supabase
    .from("trip_members")
    .select("id")
    .eq("trip_id", trip.id)
    .eq("user_id", user.id)
    .maybeSingle();

  async function rollBack() {
    await supabase.from("trips").delete().eq("id", trip.id);
  }

  const { data: course } = await supabase.from("courses").select("hole_count").eq("id", courseId).maybeSingle();
  if (!course) {
    await rollBack();
    return { status: "error", message: "That course couldn't be found." };
  }

  const snapshotInput = await loadCourseSnapshotInput(supabase, courseId);
  if (!snapshotInput.ok) {
    await rollBack();
    return { status: "error", message: "That course couldn't be found." };
  }

  const { data: round, error: roundError } = await supabase
    .from("rounds")
    .insert({
      trip_id: trip.id,
      course_id: courseId,
      name: null,
      round_date: new Date().toISOString().slice(0, 10),
      start_time: null,
      hole_count: course.hole_count,
      tournament_id: null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (roundError || !round) {
    await rollBack();
    return { status: "error", message: "Something went wrong creating the round. Please try again." };
  }

  const snapshotResult = await insertRoundCourseSnapshot(supabase, round.id, course.hole_count, snapshotInput);
  if (!snapshotResult.ok) {
    await rollBack();
    return { status: "error", message: "Something went wrong saving the course details. Please try again." };
  }

  // One addRoundPlayerAction call per selected golfer -- same insert,
  // same permanent handicap snapshot, as adding a golfer to any other
  // round by hand.
  let addedAny = false;
  for (const p of players) {
    const tripMemberId = p.memberId === myGroupMember?.id ? myTripMember?.id : memberMap[p.memberId];
    if (!tripMemberId) continue;
    const fd = new FormData();
    fd.set("tripMemberId", tripMemberId);
    if (p.teeSetName) fd.set("teeSetName", p.teeSetName);
    if (p.playingHandicap !== "" && p.playingHandicap != null) {
      fd.set("playingHandicap", String(p.playingHandicap));
    }
    const addResult = await addRoundPlayerAction(round.id, { status: "idle" }, fd);
    if (addResult.status === "success") addedAny = true;
  }

  if (!addedAny) {
    await supabase.from("rounds").delete().eq("id", round.id);
    await rollBack();
    return { status: "error", message: "Couldn't add any golfers to this round. Please try again." };
  }

  // Apply the chosen preset, if any -- inserts side_games +
  // side_game_participants directly, in the exact shape
  // createSkinsGameAction/createNassauGameAction/etc. already use
  // (src/actions/side-games.ts), so the game math those pages compute
  // is never re-implemented here. A preset never carries a saved
  // lineup (see PRESET_GAME_TYPES's doc comment), so a two-sided
  // format's sides are freshly split evenly, in the order the captain
  // selected golfers in -- editable afterward on the round's own Games
  // step, same as any other game.
  if (presetId) {
    const { data: preset } = await supabase
      .from("golf_group_game_presets")
      .select("name, side_game_type, settings")
      .eq("id", presetId)
      .eq("group_id", groupId)
      .maybeSingle();

    if (preset) {
      const { data: roundPlayerRows } = await supabase
        .from("round_players")
        .select("id, trip_member_id")
        .eq("round_id", round.id);
      const roundPlayerIdByTripMember = new Map((roundPlayerRows ?? []).map((rp) => [rp.trip_member_id, rp.id]));
      const orderedRoundPlayerIds = players
        .map((p) => {
          const tripMemberId = p.memberId === myGroupMember?.id ? myTripMember?.id : memberMap[p.memberId];
          return tripMemberId ? roundPlayerIdByTripMember.get(tripMemberId) : undefined;
        })
        .filter((id): id is string => !!id);

      const settings = (preset.settings ?? {}) as unknown as PresetSettings;
      const twoSided = preset.side_game_type === "nassau" || preset.side_game_type === "match_play";

      if (!twoSided || orderedRoundPlayerIds.length >= 2) {
        const { data: game } = await supabase
          .from("side_games")
          .insert({
            round_id: round.id,
            game_type: preset.side_game_type,
            name: preset.name,
            scoring_metric: preset.side_game_type === "stableford" ? "net" : (settings.scoringMetric ?? "net"),
            carryover: preset.side_game_type === "skins" ? (settings.carryover ?? false) : false,
            is_monetary: settings.isMonetary ?? false,
            dollar_value: settings.isMonetary ? (settings.dollarValue ?? null) : null,
            monetary_accepted_by: settings.isMonetary ? user.id : null,
            monetary_accepted_at: settings.isMonetary ? new Date().toISOString() : null,
            created_by: user.id,
          })
          .select("id")
          .single();

        if (game) {
          if (twoSided) {
            const mid = Math.ceil(orderedRoundPlayerIds.length / 2);
            const side1 = orderedRoundPlayerIds.slice(0, mid);
            const side2 = orderedRoundPlayerIds.slice(mid);
            await supabase.from("side_game_participants").insert([
              ...side1.map((id) => ({ side_game_id: game.id, round_player_id: id, side: 1 })),
              ...side2.map((id) => ({ side_game_id: game.id, round_player_id: id, side: 2 })),
            ]);
          } else {
            await supabase.from("side_game_participants").insert(
              orderedRoundPlayerIds.map((id) => ({ side_game_id: game.id, round_player_id: id, side: null })),
            );
          }
        }
      }
    }
  }

  await startRoundAction(trip.id, round.id);

  revalidatePath(`/groups/${groupId}`);
  revalidatePath(`/trips/${trip.id}`);
  redirect(`/trips/${trip.id}/rounds/${round.id}/score`);
}
