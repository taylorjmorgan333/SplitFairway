import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { GroupInviteResponse } from "@/components/invitations/group-invite-response";

export const dynamic = "force-dynamic";

// Same "never leak the real name to a link-preview scraper" reasoning
// as the trip invite page's metadata -- see its own comment.
export const metadata: Metadata = {
  title: "You're invited",
  description: "Open this link to view your golf group invitation on SplitFairway.",
  robots: { index: false, follow: false },
  openGraph: {
    title: "You're invited · SplitFairway",
    description: "Open this link to view your golf group invitation.",
  },
};

export default async function GroupInvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();

  // get_group_invitation_preview() is anon-callable and deliberately
  // minimal -- never roster, trip, or financial data, only enough to
  // render "You're invited to join <group name>" before anyone signs in.
  const { data, error } = await supabase.rpc("get_group_invitation_preview", { p_token: token });
  const preview = (error ? { status: "not_found" } : data) as {
    status: "not_found" | "revoked" | "declined" | "accepted" | "expired" | "pending";
    group_name?: string;
    role?: "member" | "guest";
  };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const nextPath = `/invite/group/${token}`;

  return (
    <div className="relative flex min-h-screen flex-col bg-forest-950">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-contour-lines opacity-40" />
      <div className="relative flex flex-1 flex-col items-center justify-center px-5 py-16">
        <Link href="/" className="mb-10" aria-label="SplitFairway home">
          <Logo variant="light" />
        </Link>

        <div className="w-full max-w-lg">
          <Card>
            <CardHeader>
              <CardTitle>{preview.status === "pending" ? "You're invited to a golf group" : "Invitation"}</CardTitle>
            </CardHeader>
            <CardContent>
              {preview.status === "not_found" && (
                <p className="text-sm text-charcoal-500">
                  This invitation link isn&apos;t valid. Double-check the link, or ask the group owner
                  for a new one.
                </p>
              )}

              {preview.status === "revoked" && (
                <p className="text-sm text-charcoal-500">
                  This invitation to <strong>{preview.group_name}</strong> has been revoked.
                </p>
              )}

              {preview.status === "declined" && (
                <p className="text-sm text-charcoal-500">
                  This invitation to <strong>{preview.group_name}</strong> was already declined.
                </p>
              )}

              {preview.status === "expired" && (
                <p className="text-sm text-charcoal-500">
                  This invitation to <strong>{preview.group_name}</strong> has expired. Ask the group
                  owner to send a new one.
                </p>
              )}

              {preview.status === "accepted" && (
                <div className="space-y-4">
                  <p className="text-sm text-charcoal-500">
                    You&apos;ve already joined <strong>{preview.group_name}</strong>.
                  </p>
                  {user ? (
                    <ButtonLink href="/groups">Go to your groups</ButtonLink>
                  ) : (
                    <ButtonLink href={`/login?next=${encodeURIComponent("/groups")}`}>Log in</ButtonLink>
                  )}
                </div>
              )}

              {preview.status === "pending" && (
                <div className="space-y-5">
                  <div>
                    <p className="text-sm text-charcoal-500">You&apos;ve been invited to join</p>
                    <p className="mt-0.5 text-xl text-forest-900">{preview.group_name}</p>
                    <p className="mt-1 text-sm text-charcoal-500">
                      {preview.role === "guest"
                        ? "As a guest, you'll go straight to the current round to enter your scores."
                        : "As a member, you'll get the group's full dashboard, leaderboard, and round history."}
                    </p>
                  </div>

                  {user ? (
                    <GroupInviteResponse token={token} />
                  ) : (
                    <div className="flex flex-wrap gap-3">
                      <ButtonLink href={`/signup?next=${encodeURIComponent(nextPath)}`}>Sign up to join</ButtonLink>
                      <ButtonLink href={`/login?next=${encodeURIComponent(nextPath)}`} variant="outline">
                        I already have an account
                      </ButtonLink>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
