"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { trackEvent } from "@/lib/analytics";

/**
 * Accepts an invitation token for the currently signed-in user.
 * accept_trip_invitation() does the real work server-side: it's an
 * atomic check-and-set UPDATE (status = 'pending' AND not expired ->
 * 'accepted'), so a token can never be consumed twice even under a
 * race, and it independently verifies the signed-in user's email
 * matches the invitation before joining them to the trip.
 */
export async function acceptInvitationAction(token: string): Promise<{ tripId: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_trip_invitation", { p_token: token });

  if (error) {
    throw new Error(error.message);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    await trackEvent(supabase, user.id, "invite_accepted", {}, data.trip_id);
  }

  revalidatePath("/dashboard");
  return { tripId: data.trip_id };
}

/**
 * Declines an invitation token. Doesn't require an account —
 * decline_trip_invitation() is deliberately granted to the anon role,
 * since someone should be able to say "no thanks" without signing up.
 */
export async function declineInvitationAction(token: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("decline_trip_invitation", { p_token: token });

  if (error) {
    throw new Error(error.message);
  }
}
