"use server";

import { createClient } from "@/lib/supabase/server";
import { signUpSchema } from "@/lib/validation/auth";
import type { ActionState } from "@/actions/auth";

/**
 * "Create an account to save your history" (spec item 1's closing
 * requirement) for a golfer currently playing as a passwordless guest.
 * Deliberately NOT signUpAction -- that calls supabase.auth.signUp(),
 * which creates a *brand-new* auth.users row, orphaning every
 * trip_members/round_players/hole_scores row already linked to this
 * session's anonymous auth.uid(). This instead calls
 * supabase.auth.updateUser() on the *same*, still-signed-in anonymous
 * session -- Supabase's own documented anonymous-to-permanent
 * conversion path -- so the uid never changes and everything already
 * scored stays exactly where it is.
 *
 * Setting an email on an anonymous user requires confirming it (so a
 * stranger can't claim an email they don't own just by editing a
 * request) -- until that confirmation link is clicked, auth.users.is_anonymous
 * stays true and the account isn't a normal login yet, even though the
 * password is already set and the scores are already permanently
 * theirs either way. The UI copy below says this plainly rather than
 * implying the account is immediately fully active.
 */
export async function convertGuestAccountAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = signUpSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return { status: "error", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.is_anonymous) {
    return { status: "error", message: "This is only for finishing a guest scoring session." };
  }

  const { error } = await supabase.auth.updateUser({
    email: parsed.data.email,
    password: parsed.data.password,
    data: { full_name: parsed.data.fullName },
  });

  if (error) {
    return { status: "error", message: error.message };
  }

  return {
    status: "success",
    message: "Almost done — check your inbox and confirm your email to finish creating your account. Your scores are already saved either way.",
  };
}
