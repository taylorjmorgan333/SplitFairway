import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { signOutAction } from "@/actions/auth";
import { DeleteAccountForm } from "@/components/account/delete-account-form";
import { GolfProfileSection } from "@/components/account/golf-profile-section";
import { GOLF_SCORING_ENABLED } from "@/lib/config";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Account settings" };

export default async function AccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const fullName = (user.user_metadata?.full_name as string | undefined) ?? "";

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-2xl">Account settings</h1>
      <p className="mt-1.5 text-sm text-charcoal-500">
        Manage your profile and sign-in details.
      </p>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>
            Editing your name and email isn&apos;t wired up yet — this is a
            preview of the settings screen.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-5">
            <div>
              <Label htmlFor="fullName">Full name</Label>
              <Input id="fullName" defaultValue={fullName} disabled />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" defaultValue={user.email ?? ""} disabled />
            </div>
          </div>
        </CardContent>
      </Card>

      {GOLF_SCORING_ENABLED && <GolfProfileSection userId={user.id} />}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Session</CardTitle>
          <CardDescription>Sign out of SplitFairway on this device.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={signOutAction}>
            <Button type="submit" variant="outline">
              Log out
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Danger zone</CardTitle>
          <CardDescription>Permanently delete your account and personal data.</CardDescription>
        </CardHeader>
        <CardContent>
          <DeleteAccountForm />
        </CardContent>
      </Card>
    </div>
  );
}
