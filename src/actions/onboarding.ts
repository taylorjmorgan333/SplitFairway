"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Marks this account's lightweight, one-time onboarding done (spec item
 * 8: "returning users should never be forced through onboarding
 * again"). Uses a real profiles column rather than the existing
 * per-browser localStorage helpers in src/lib/onboarding.ts -- those
 * are a different, pre-existing, trip-scoped "dismiss this checklist"
 * mechanism (see their own doc comment); this needs to hold even
 * across devices/browsers, which only a database column can do.
 */
export async function completeOnboardingAction(next: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    await supabase
      .from("profiles")
      .update({ onboarding_completed_at: new Date().toISOString() })
      .eq("id", user.id);
  }
  redirect(next && next.startsWith("/") ? next : "/dashboard");
}
