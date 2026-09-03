"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { addMemberManuallySchema, inviteMemberSchema, transferOwnershipSchema } from "@/lib/validation/trip";
import { trackEvent } from "@/lib/analytics";
import type { ActionState } from "@/actions/auth";
import type { Enums } from "@/lib/supabase/database.types";

// The raw invitation token is only ever returned once, at the moment
// it's created (by invite_trip_member/resend_trip_invitation) — it's
// never stored anywhere except as a salted hash, so this is the only
// chance the UI gets to show a copyable link. inviteLink is therefore
// carried on the action result rather than persisted or refetched.
export type InviteActionState = ActionState & { inviteLink?: string };

function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

export async function inviteMemberAction(
  tripId: string,
  _prevState: InviteActionState,
  formData: FormData,
): Promise<InviteActionState> {
  const parsed = inviteMemberSchema.safeParse({
    email: formData.get("email"),
    displayName: formData.get("displayName"),
    role: formData.get("role") || "member",
  });

  if (!parsed.success) {
    return { status: "error", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  // RLS on trip_invitations only allows captains to select rows, and
  // invite_trip_member() itself checks is_trip_captain() internally
  // before inserting anything — so a non-captain call fails server-side
  // even though the button is hidden for them in the UI. It's also
  // rate-limited (20/hour) inside the function.
  const { data, error } = await supabase.rpc("invite_trip_member", {
    p_trip_id: tripId,
    p_email: parsed.data.email,
    p_display_name: parsed.data.displayName,
    p_role: parsed.data.role,
  });

  if (error) {
    return { status: "error", message: error.message };
  }

  const token = (data as { token?: string } | null)?.token;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    await trackEvent(supabase, user.id, "golfer_invited", { role: parsed.data.role }, tripId);
  }

  revalidatePath(`/trips/${tripId}`);
  return {
    status: "success",
    message: `Invitation created for ${parsed.data.email}. Copy the link below to send it — this is the only time it's shown.`,
    inviteLink: token ? `${siteUrl()}/invite/${token}` : undefined,
  };
}

export async function addMemberManuallyAction(
  tripId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = addMemberManuallySchema.safeParse({
    displayName: formData.get("displayName"),
    email: formData.get("email"),
  });

  if (!parsed.success) {
    return { status: "error", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  // add_trip_member_manually() checks is_trip_captain() internally and
  // inserts the golfer straight in as status='active' with no
  // invitation token — for someone who won't check an inbox, the
  // captain can get them tracked (scores, expenses, splits) right now.
  // If they want that golfer to actually log in later, the normal
  // "Invite a golfer" flow above still works on the same person —
  // it's keyed off email, not this action.
  const { error } = await supabase.rpc("add_trip_member_manually", {
    p_trip_id: tripId,
    p_display_name: parsed.data.displayName,
    p_email: parsed.data.email ? parsed.data.email : undefined,
  });

  if (error) {
    return { status: "error", message: error.message };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    await trackEvent(supabase, user.id, "golfer_added_manually", {}, tripId);
  }

  revalidatePath(`/trips/${tripId}`);
  return {
    status: "success",
    message: `${parsed.data.displayName} was added to the trip and is active now.`,
  };
}

export async function resendInvitationAction(
  tripId: string,
  tripMemberId: string,
): Promise<{ inviteLink: string }> {
  const supabase = await createClient();
  // resend_trip_invitation() checks is_trip_captain() and rate-limits
  // (10/hour) internally, and revokes the member's previous pending
  // token before issuing a new one, so an old copied link stops
  // working the instant a fresh one exists.
  const { data, error } = await supabase.rpc("resend_trip_invitation", {
    p_trip_member_id: tripMemberId,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/trips/${tripId}`);
  const token = (data as { token?: string } | null)?.token;
  if (!token) {
    throw new Error("The invitation was resent, but no link was returned.");
  }
  return { inviteLink: `${siteUrl()}/invite/${token}` };
}

export async function revokeInvitationAction(tripId: string, tripMemberId: string) {
  const supabase = await createClient();
  // revoke_trip_invitation() checks is_trip_captain() internally.
  const { error } = await supabase.rpc("revoke_trip_invitation", {
    p_trip_member_id: tripMemberId,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/trips/${tripId}`);
}

export async function transferOwnershipAction(
  tripId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = transferOwnershipSchema.safeParse({
    newOwnerTripMemberId: formData.get("newOwnerTripMemberId"),
    confirmation: formData.get("confirmation"),
  });

  if (!parsed.success) {
    return { status: "error", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  // transfer_trip_ownership() independently re-checks that the caller
  // IS the current owner server-side — the typed "TRANSFER" above is
  // the client-side explicit-confirmation step the spec asks for, not
  // the security boundary.
  const { error } = await supabase.rpc("transfer_trip_ownership", {
    p_trip_id: tripId,
    p_new_owner_trip_member_id: parsed.data.newOwnerTripMemberId,
  });

  if (error) {
    return { status: "error", message: error.message };
  }

  revalidatePath(`/trips/${tripId}`);
  return { status: "success", message: "Trip ownership transferred." };
}

export async function setMemberRoleAction(
  tripId: string,
  tripMemberId: string,
  role: Enums<"member_role">,
) {
  const supabase = await createClient();
  // set_trip_member_role() checks is_trip_captain() internally and the
  // "at least one active captain" trigger blocks demoting the last one.
  const { error } = await supabase.rpc("set_trip_member_role", {
    p_trip_member_id: tripMemberId,
    p_role: role,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/trips/${tripId}`);
}

export async function removeMemberAction(tripId: string, tripMemberId: string) {
  const supabase = await createClient();
  // RLS (trip_members_update_captain) enforces captain-only here; the
  // last-captain trigger blocks removing a trip's final captain. Once
  // removed, this member is excluded from future expense splits — the
  // client only ever offers "active" members as split candidates — but
  // their historical expense_shares and payments are left untouched so
  // past balances stay accurate.
  const { data: member, error } = await supabase
    .from("trip_members")
    .update({ status: "removed" })
    .eq("id", tripMemberId)
    .select("display_name")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    await supabase.from("activity_log").insert({
      trip_id: tripId,
      actor_user_id: user.id,
      event_type: "member_removed",
      event_data: { trip_member_id: tripMemberId, display_name: member?.display_name ?? null },
    });
  }

  revalidatePath(`/trips/${tripId}`);
}
