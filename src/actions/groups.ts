"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  createGroupSchema,
  updateGroupSchema,
  addGroupMemberSchema,
  updateGroupMemberSchema,
  createGroupGamePresetSchema,
  createGroupSeasonSchema,
} from "@/lib/validation/group";
import type { ActionState } from "@/actions/auth";
import type { Json } from "@/lib/supabase/database.types";

/**
 * Creates a saved golf group and makes the creator its first (owner)
 * member, atomically -- via create_group(), which mirrors create_trip()'s
 * own trip+captain insert pattern exactly (see the migration comment on
 * public.create_group).
 */
export async function createGroupAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = createGroupSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
  });

  if (!parsed.success) {
    return { status: "error", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_group", {
    p_name: parsed.data.name,
    p_description: parsed.data.description || undefined,
  });

  if (error || !data) {
    return { status: "error", message: error?.message ?? "Could not create the group." };
  }

  revalidatePath("/groups");
  redirect(`/groups/${data.id}`);
}

export async function updateGroupAction(
  groupId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = updateGroupSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
  });

  if (!parsed.success) {
    return { status: "error", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  // RLS (golf_groups_update_owner) already restricts this to the
  // group's owner -- no separate authorization check needed here.
  const { error } = await supabase
    .from("golf_groups")
    .update({
      name: parsed.data.name,
      description: parsed.data.description || null,
    })
    .eq("id", groupId);

  if (error) {
    return { status: "error", message: "Couldn't save those changes. Make sure you own this group." };
  }

  revalidatePath(`/groups/${groupId}`);
  return { status: "success", message: "Group updated." };
}

export async function deleteGroupAction(groupId: string): Promise<void> {
  const supabase = await createClient();
  // RLS (golf_groups_delete_owner) restricts this to the owner. Trips
  // already started from this group (trips.golf_group_id) are kept --
  // the column is on delete set null, so their history/rounds/expenses
  // are entirely unaffected.
  await supabase.from("golf_groups").delete().eq("id", groupId);
  revalidatePath("/groups");
  redirect("/groups");
}

export async function addGroupMemberAction(
  groupId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = addGroupMemberSchema.safeParse({
    displayName: formData.get("displayName"),
    email: formData.get("email"),
    defaultHandicapIndex: formData.get("defaultHandicapIndex"),
    preferredTeeName: formData.get("preferredTeeName"),
  });

  if (!parsed.success) {
    return { status: "error", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const { displayName, email, defaultHandicapIndex, preferredTeeName } = parsed.data;

  // RLS (golf_group_members_insert_owner) restricts this to the
  // group's owner.
  const { error } = await supabase.from("golf_group_members").insert({
    group_id: groupId,
    display_name: displayName,
    email: email || null,
    default_handicap_index:
      defaultHandicapIndex === "" || defaultHandicapIndex === undefined
        ? null
        : defaultHandicapIndex,
    preferred_tee_name: preferredTeeName || null,
  });

  if (error) {
    return {
      status: "error",
      message: "Couldn't add that golfer. Make sure you own this group.",
    };
  }

  revalidatePath(`/groups/${groupId}`);
  return { status: "success", message: "Golfer added to the group." };
}

/**
 * Edits a saved golfer's own record (name, handicap, preferred tee,
 * email) -- owner-only per RLS (golf_group_members_update_owner). This
 * only changes what a *future* round's setup pre-fills; every round
 * already played keeps its own permanent playing_handicap snapshot on
 * round_players (see the doc comment on
 * golf_group_members.default_handicap_index), so editing a handicap
 * here can never retroactively change a completed round's results.
 */
export async function updateGroupMemberAction(
  groupId: string,
  memberId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = updateGroupMemberSchema.safeParse({
    displayName: formData.get("displayName"),
    email: formData.get("email"),
    defaultHandicapIndex: formData.get("defaultHandicapIndex"),
    preferredTeeName: formData.get("preferredTeeName"),
  });

  if (!parsed.success) {
    return { status: "error", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const { displayName, email, defaultHandicapIndex, preferredTeeName } = parsed.data;

  const { error } = await supabase
    .from("golf_group_members")
    .update({
      display_name: displayName,
      email: email || null,
      default_handicap_index:
        defaultHandicapIndex === "" || defaultHandicapIndex === undefined
          ? null
          : defaultHandicapIndex,
      preferred_tee_name: preferredTeeName || null,
    })
    .eq("id", memberId)
    .eq("group_id", groupId);

  if (error) {
    return { status: "error", message: "Couldn't save those changes. Make sure you own this group." };
  }

  revalidatePath(`/groups/${groupId}`);
  return { status: "success", message: "Golfer updated." };
}

export async function removeGroupMemberAction(groupId: string, memberId: string): Promise<void> {
  const supabase = await createClient();
  // RLS (golf_group_members_delete_owner) restricts this to the owner.
  await supabase.from("golf_group_members").delete().eq("id", memberId);
  revalidatePath(`/groups/${groupId}`);
}

/**
 * Turns the four supported preset types' parsed, type-specific fields
 * into the settings jsonb golf_group_game_presets.settings stores.
 * Deliberately never stores a player/side list -- see the doc comment
 * on PRESET_GAME_TYPES ("do not automatically reuse old teams").
 */
function presetSettingsFromParsed(
  data: ReturnType<typeof createGroupGamePresetSchema.parse>,
): Json {
  switch (data.sideGameType) {
    case "skins":
      return {
        scoringMetric: data.scoringMetric,
        carryover: data.carryover,
        isMonetary: data.isMonetary,
        dollarValue: data.dollarValue,
      };
    case "nassau":
    case "match_play":
      return {
        scoringMetric: data.scoringMetric,
        isMonetary: data.isMonetary,
        dollarValue: data.dollarValue,
      };
    case "stableford":
      return {
        isMonetary: data.isMonetary,
        dollarValue: data.dollarValue,
      };
  }
}

function parsePresetForm(groupId: string, formData: FormData) {
  return createGroupGamePresetSchema.safeParse({
    name: formData.get("name"),
    sideGameType: formData.get("sideGameType"),
    scoringMetric: formData.get("scoringMetric") || undefined,
    carryover: formData.get("carryover") === "on",
    isMonetary: formData.get("isMonetary") === "on",
    dollarValue: formData.get("dollarValue"),
  });
}

export async function createGroupGamePresetAction(
  groupId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = parsePresetForm(groupId, formData);

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

  // RLS (golf_group_game_presets_insert_members) allows any group
  // member to save a preset -- these are just reusable notes for
  // setting up a round's games the same way the group already does, not
  // something that needs owner-only gatekeeping.
  const { error } = await supabase.from("golf_group_game_presets").insert({
    group_id: groupId,
    name: parsed.data.name,
    side_game_type: parsed.data.sideGameType,
    settings: presetSettingsFromParsed(parsed.data),
    created_by: user.id,
  });

  if (error) {
    return { status: "error", message: "Couldn't save that preset." };
  }

  revalidatePath(`/groups/${groupId}`);
  return { status: "success", message: "Preset saved." };
}

/** Renames/edits an existing preset in place -- any member may (RLS golf_group_game_presets_update_members), matching who may create one. */
export async function updateGroupGamePresetAction(
  groupId: string,
  presetId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = parsePresetForm(groupId, formData);

  if (!parsed.success) {
    return { status: "error", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("golf_group_game_presets")
    .update({
      name: parsed.data.name,
      side_game_type: parsed.data.sideGameType,
      settings: presetSettingsFromParsed(parsed.data),
    })
    .eq("id", presetId)
    .eq("group_id", groupId);

  if (error) {
    return { status: "error", message: "Couldn't save that preset." };
  }

  revalidatePath(`/groups/${groupId}`);
  return { status: "success", message: "Preset updated." };
}

/** Copies an existing preset (name suffixed "(copy)") so a captain can start a near-duplicate ($5 Nassau from $2 Nassau) without retyping every setting. */
export async function duplicateGroupGamePresetAction(groupId: string, presetId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: original } = await supabase
    .from("golf_group_game_presets")
    .select("name, side_game_type, settings")
    .eq("id", presetId)
    .eq("group_id", groupId)
    .maybeSingle();

  if (!original) return;

  await supabase.from("golf_group_game_presets").insert({
    group_id: groupId,
    name: `${original.name} (copy)`,
    side_game_type: original.side_game_type,
    settings: original.settings,
    created_by: user.id,
  });

  revalidatePath(`/groups/${groupId}`);
}

export async function deleteGroupGamePresetAction(groupId: string, presetId: string): Promise<void> {
  const supabase = await createClient();
  // RLS (golf_group_game_presets_delete_owner) restricts this to the
  // group's owner.
  await supabase.from("golf_group_game_presets").delete().eq("id", presetId);
  revalidatePath(`/groups/${groupId}`);
}

/** Creates a custom season (owner-only, RLS golf_group_seasons_insert_owner). A group with no custom seasons simply falls back to the current calendar year -- see resolveCurrentSeason(). */
export async function createGroupSeasonAction(
  groupId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = createGroupSeasonSchema.safeParse({
    name: formData.get("name"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
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

  const { error } = await supabase.from("golf_group_seasons").insert({
    group_id: groupId,
    name: parsed.data.name,
    start_date: parsed.data.startDate,
    end_date: parsed.data.endDate,
    created_by: user.id,
  });

  if (error) {
    return { status: "error", message: "Couldn't save that season. Make sure you own this group." };
  }

  revalidatePath(`/groups/${groupId}`);
  return { status: "success", message: "Season created." };
}

export async function deleteGroupSeasonAction(groupId: string, seasonId: string): Promise<void> {
  const supabase = await createClient();
  // RLS (golf_group_seasons_delete_owner) restricts this to the owner.
  // Rounds already played aren't tagged with a season_id (see
  // group-seasons.ts's doc comment) -- deleting a season just removes
  // its date range, it never touches a round.
  await supabase.from("golf_group_seasons").delete().eq("id", seasonId);
  revalidatePath(`/groups/${groupId}`);
}

/**
 * Start a Round, "Quick Round" path: begins scoring without creating a
 * group or a trip the user ever sees. Under the hood this still needs a
 * trip row for round_players/expenses to hang off of (see the migration
 * comment on trips.kind) -- start_quick_round_trip() creates one, hidden
 * from /trips, and this redirects straight into the existing round-setup
 * screen exactly as if a captain had just made a real trip.
 */
export async function startQuickRoundAction(): Promise<void> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("start_quick_round_trip");

  if (error || !data) {
    redirect("/play?error=quick-round");
  }

  redirect(`/trips/${data!.id}/rounds/new`);
}

/**
 * Start a Round, "Group Round" path, full roster: same idea, but the
 * hidden trip's roster is pre-filled from every one of the saved
 * group's golfers (start_group_round_trip copies them in as
 * trip_members via add_trip_member_manually -- the same function the
 * manual "add a golfer" flow already uses). The fast-start wizard at
 * /play/group/[groupId]/start (src/actions/group-rounds.ts) is the
 * normal path now -- it lets a captain choose which golfers are playing
 * today -- but this untouched, full-roster action stays as a fallback
 * entry point (e.g. a group with only one saved golfer, or a captain
 * who just wants everyone in).
 */
export async function startGroupRoundAction(groupId: string): Promise<void> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("start_group_round_trip", {
    p_group_id: groupId,
  });

  if (error || !data) {
    redirect("/play?error=group-round");
  }

  redirect(`/trips/${data!.id}/rounds/new`);
}

/**
 * Lets a trip captain connect a real trip to one of their saved groups
 * (or clear the connection with groupId = null) -- purely informational,
 * doesn't change either side's membership or data.
 */
export async function attachTripToGroupAction(tripId: string, groupId: string | null): Promise<ActionState> {
  const supabase = await createClient();
  // attach_trip_to_group's generated Args type is `p_group_id: string`
  // (Supabase's type generator has no way to know a plain `uuid`
  // parameter with no SQL default also accepts null) even though the
  // function itself explicitly supports clearing the connection with
  // null -- see this function's own doc comment. Asserting the args
  // object's type here is purely to work around that generator gap,
  // not a change in what's actually sent.
  const { error } = await supabase.rpc("attach_trip_to_group", {
    p_trip_id: tripId,
    p_group_id: groupId,
  } as { p_trip_id: string; p_group_id: string });

  if (error) {
    return { status: "error", message: "Couldn't update that. Make sure you're a captain on this trip and a member of the group." };
  }

  revalidatePath(`/trips/${tripId}`);
  return { status: "success", message: "Trip updated." };
}
