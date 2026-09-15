import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GolfProfileSection } from "@/components/account/golf-profile-section";
import { GOLF_SCORING_ENABLED } from "@/lib/config";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Settings" };

/**
 * Split out of /account so "Account" and "Settings" in ProfileMenu lead
 * somewhere genuinely different, instead of both pointing at the same
 * page -- the exact redundancy the profile menu was built to remove.
 * Account keeps identity/session/danger-zone (who you are, signing
 * out, deleting your account); Settings holds golf-specific
 * preferences (handicap, home course) that a golfer tunes once and
 * rarely revisits, which is a settings-page concern rather than an
 * account-identity one.
 */
export default async function AccountSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-2xl">Settings</h1>
      <p className="mt-1.5 text-sm text-charcoal-500">Your golf preferences for scoring and handicaps.</p>

      {GOLF_SCORING_ENABLED ? (
        <GolfProfileSection userId={user.id} />
      ) : (
        <p className="mt-6 text-sm text-charcoal-400">No settings available yet.</p>
      )}
    </div>
  );
}
