"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  createGroupSchema,
  updateGroupSchema,
  addGroupMemberSchema,
  createGroupGamePresetSchema,
} from "@/lib/validation/group";
import type { ActionState } from "@/actions/auth";

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

export async function removeGroupMemberAction(groupId: string, memberId: string): Promise<void> {
  const supabase = await createClient();
  // RLS (golf_group_members_delete_owner) restricts this to the owner.
  await supabase.from("golf_group_members").delete().eq("id", memberId);
  revalidatePath(`/groups/${groupId}`);
}

export async function createGroupGamePresetAction(
  groupId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = createGroupGamePresetSchema.safeParse({
    name: formData.get("name"),
    sideGameType: formData.get("sideGameType"),
    notes: formData.get("notes"),
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

  const { name, sideGameType, notes } = parsed.data;

  // RLS (golf_group_game_presets_insert_members) allows any group
  // member to save a preset -- these are just reusable notes for
  // setting up a round's games the same way the group already does, not
  // something that needs owner-only gatekeeping.
  const { error } = await supabase.from("golf_group_game_presets").insert({
    group_id: groupId,
    name,
    side_game_type: sideGameType,
    settings: notes ? { notes } : {},
    created_by: user.id,
  });

  if (error) {
    return { status: "error", message: "Couldn't save that preset." };
  }

  revalidatePath(`/groups/${groupId}`);
  return { status: "success", message: "Preset saved." };
}

export async function deleteGroupGamePresetAction(groupId: string, presetId: string): Promise<void> {
  const supabase = await createClient();
  // RLS (golf_group_game_presets_delete_owner) restricts this to the
  // group's owner.
  await supabase.from("golf_group_game_presets").delete().eq("id", presetId);
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
 * Start a Round, "Group Round" path: same idea, but the hidden trip's
 * roster is pre-filled from the saved group's golfers (start_group_round_trip
 * copies them in as trip_members via add_trip_member_manually — the same
 * function the manual "add a golfer" flow already uses).
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
  const { error } = await supabase.rpc("attach_trip_to_group", {
    p_trip_id: tripId,
    p_group_id: groupId,
  });

  if (error) {
    return { status: "error", message: "Couldn't update that. Make sure you're a captain on this trip and a member of the group." };
  }

  revalidatePath(`/trips/${tripId}`);
  return { status: "success", message: "Trip updated." };
}
