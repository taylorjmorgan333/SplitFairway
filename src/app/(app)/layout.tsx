import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/layout/app-shell";

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
