import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { GolfProfileForm } from "@/components/account/golf-profile-form";
import { GHIN_SCREENSHOT_IMPORT_ENABLED } from "@/lib/config";

/**
 * Server-fetches the signed-in user's own golf_profiles row and recent
 * handicap_history, then hands them to the client form. Both queries
 * run as the authenticated user through the normal RLS-respecting
 * client — golf_profiles_select_own and handicap_history_select_own
 * (supabase/migrations/20260903000000_golf_profiles.sql) are what
 * actually restrict this to the caller's own rows; nothing here is a
 * privileged/service-role read.
 */
export async function GolfProfileSection({ userId }: { userId: string }) {
  const supabase = await createClient();

  const [{ data: profile }, { data: history }] = await Promise.all([
    supabase.from("golf_profiles").select("*").eq("user_id", userId).maybeSingle(),
    supabase
      .from("handicap_history")
      .select("*")
      .eq("user_id", userId)
      .order("recorded_at", { ascending: false })
      .limit(5),
  ]);

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Golf profile</CardTitle>
        <CardDescription>
          Your handicap and GHIN details for scoring and games — entered by you.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <GolfProfileForm
          profile={profile ?? null}
          history={history ?? []}
          ghinImportEnabled={GHIN_SCREENSHOT_IMPORT_ENABLED}
        />
      </CardContent>
    </Card>
  );
}
