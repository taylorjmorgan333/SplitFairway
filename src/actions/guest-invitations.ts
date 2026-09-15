"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createGuestInvitationSchema } from "@/lib/validation/group";
import type { ActionState } from "@/actions/auth";

type GuestInviteState = ActionState & { token?: string };

/**
 * Captain-only. Creates a passwordless guest scoring link for one
 * specific round (spec item 1) -- create_group_guest_invitation()
 * does the real work: a trip_members row (is_guest = true, no
 * account yet) plus a round_players row for this round, in one
 * transaction, plus the hashed-token invitation row itself. groupId
 * is passed through only for display context on the invitation --
 * authorization is always trip-captain-based, never group-ownership-
 * based, matching every other round-player write in this app.
 */
export async function createGuestInvitationAction(
  tripId: string,
  roundId: string,
  groupId: string | null,
  _prevState: GuestInviteState,
  formData: FormData,
): Promise<GuestInviteState> {
  const parsed = createGuestInvitationSchema.safeParse({
    guestDisplayName: formData.get("guestDisplayName"),
  });

  if (!parsed.success) {
    return { status: "error", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_group_guest_invitation", {
    p_trip_id: tripId,
    p_round_id: roundId,
    p_guest_display_name: parsed.data.guestDisplayName || "Guest",
    p_group_id: groupId ?? undefined,
  });

  if (error || !data) {
    return { status: "error", message: error?.message ?? "Couldn't create that guest link." };
  }

  const result = data as unknown as { invitation_id: string; token: string; guest_display_name: string };

  revalidatePath(`/trips/${tripId}/rounds/${roundId}`);
  return { status: "success", message: `Guest link created for ${result.guest_display_name}.`, token: result.token };
}

/**
 * Cuts off live access immediately, not just future redemptions --
 * see revoke_group_guest_invitation()'s own comment. Does not remove
 * the guest's round_players row or any scores they already entered;
 * removing them from the round entirely is still the existing,
 * separate captain-only "Remove" action on that player row.
 */
export async function revokeGuestInvitationAction(tripId: string, roundId: string, invitationId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_group_guest_invitation", { p_invitation_id: invitationId });
  if (error) {
    throw new Error(error.message);
  }
  revalidatePath(`/trips/${tripId}/rounds/${roundId}`);
}

/**
 * Retires the old token and issues a fresh one for the same guest
 * golfer -- same trip_member/round_player, any scores already entered
 * stay put. Returns the new token so the UI can show/copy the new
 * link immediately, same as creation does.
 */
export async function regenerateGuestInvitationAction(
  tripId: string,
  roundId: string,
  invitationId: string,
): Promise<{ token: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("regenerate_group_guest_invitation", {
    p_invitation_id: invitationId,
  });
  if (error || !data) {
    throw new Error(error?.message ?? "Couldn't regenerate that guest link.");
  }
  revalidatePath(`/trips/${tripId}/rounds/${roundId}`);
  const result = data as unknown as { invitation_id: string; token: string };
  return { token: result.token };
}

/**
 * The only function a guest's own session calls, and the only place
 * in this app that ever calls supabase.auth.signInAnonymously(). If
 * the visitor already has a session (a real account, or a previously-
 * redeemed anonymous one), that session is reused as-is -- redemption
 * just relinks whichever auth.uid() is asking right now, anonymous or
 * not, which is also what makes "sign up later without losing your
 * scores" work (see convertGuestAccountAction): the anonymous
 * auth.uid() never changes when it's upgraded to a real account.
 *
 * If Supabase's "Anonymous Sign-Ins" project setting isn't turned on
 * (a one-time Dashboard toggle this app's own env vars can't reach --
 * see GUEST_SCORING_ENABLED's comment in lib/config.ts), signInAnonymously
 * fails cleanly and this returns a plain, honest error instead of a
 * broken or partially-authenticated state.
 */
export async function redeemGuestInvitationAction(
  token: string,
): Promise<{ tripId: string; roundId: string; guestDisplayName: string; redirectPath: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const { error: anonError } = await supabase.auth.signInAnonymously();
    if (anonError) {
      throw new Error(
        "Guest scoring isn't turned on for this app yet — ask your captain to invite you the normal way instead.",
      );
    }
  }

  const { data, error } = await supabase.rpc("redeem_group_guest_invitation", { p_token: token });
  if (error || !data) {
    throw new Error(error?.message ?? "Couldn't open that guest link.");
  }

  const result = data as unknown as {
    trip_id: string;
    round_id: string;
    trip_member_id: string;
    round_player_id: string;
    guest_display_name: string;
  };

  return {
    tripId: result.trip_id,
    roundId: result.round_id,
    guestDisplayName: result.guest_display_name,
    redirectPath: `/trips/${result.trip_id}/rounds/${result.round_id}/score`,
  };
}
