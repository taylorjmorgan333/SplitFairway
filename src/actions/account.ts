"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { deleteAccountSchema } from "@/lib/validation/auth";
import type { ActionState } from "@/actions/auth";

/**
 * Permanently deletes the signed-in user's own account.
 *
 * Deliberately does NOT use the Supabase service-role Admin API — this
 * project's production environment never sets SUPABASE_SERVICE_ROLE_KEY
 * (see README/.env.example), so this runs entirely as the normal
 * authenticated user through the RLS-respecting client, re-authenticates
 * them first (current password), then calls the
 * public.delete_own_account() SECURITY DEFINER function, which is the
 * one place with elevated privilege and is scoped to auth.uid() only —
 * see supabase/migrations/20260902070000_account_deletion.sql for
 * exactly what it deletes/anonymizes and why.
 */
export async function deleteAccountAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = deleteAccountSchema.safeParse({
    password: formData.get("password"),
    confirmation: formData.get("confirmation"),
  });

  if (!parsed.success) {
    return { status: "error", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return { status: "error", message: "You need to be signed in to delete your account." };
  }

  // Re-authentication: proves whoever is at this keyboard right now
  // still knows the account's password, not just that a session cookie
  // happens to be sitting in the browser.
  const { error: reauthError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: parsed.data.password,
  });

  if (reauthError) {
    return {
      status: "error",
      fieldErrors: { password: ["That password is incorrect."] },
    };
  }

  const { error: deleteError } = await supabase.rpc("delete_own_account");

  if (deleteError) {
    return {
      status: "error",
      message:
        "Something went wrong deleting your account. Nothing was changed — please try again, or email support if this keeps happening.",
    };
  }

  // The account no longer exists — clear the session cookie/local
  // client state rather than leaving a cookie pointing at a deleted
  // user around.
  await supabase.auth.signOut();
  redirect("/account-deleted");
}
