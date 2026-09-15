import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/layout/app-shell";
import { GuestShell } from "@/components/layout/guest-shell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // A passwordless guest (spec item 1) is a real Supabase Auth user
  // (is_anonymous = true) so every RLS-gated query below still works
  // for them exactly as it does for anyone else -- but they get the
  // minimal GuestShell instead of the full dashboard chrome, and skip
  // the new-user onboarding gate and the admin check entirely (there
  // is nothing there for a one-round guest to onboard into or ever be
  // an admin of).
  if (user.is_anonymous) {
    const { data: guestMembership } = await supabase
      .from("trip_members")
      .select("display_name")
      .eq("user_id", user.id)
      .eq("is_guest", true)
      .maybeSingle();
    return <GuestShell guestName={guestMembership?.display_name}>{children}</GuestShell>;
  }

  // New users only (spec item 8) -- onboarding_completed_at is
  // backfilled to now() for every account that existed before this
  // column was added, so nobody already using the app sees this.
  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_completed_at")
    .eq("id", user.id)
    .maybeSingle();
  if (profile && !profile.onboarding_completed_at) {
    redirect("/onboarding");
  }

  const { data: isAdmin } = await supabase.rpc("is_app_admin");

  return (
    <AppShell email={user.email ?? "Your account"} isAdmin={Boolean(isAdmin)}>
      {children}
    </AppShell>
  );
}
