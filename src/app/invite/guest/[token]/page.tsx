import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Logo } from "@/components/ui/logo";
import { GuestInviteResponse } from "@/components/invitations/guest-invite-response";
import { formatDate } from "@/lib/utils";
import { GUEST_SCORING_ENABLED } from "@/lib/config";

export const dynamic = "force-dynamic";

// Same "never leak real names/details to a link-preview scraper"
// reasoning as the trip/group invite pages' own metadata.
export const metadata: Metadata = {
  title: "You're invited to score",
  description: "Open this link to score a round on SplitFairway -- no account needed.",
  robots: { index: false, follow: false },
  openGraph: {
    title: "You're invited · SplitFairway",
    description: "Open this link to score a round -- no account needed.",
  },
};

export default async function GuestInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();

  // get_guest_invitation_preview() is anon-callable and deliberately
  // minimal -- never roster, trip, or financial data, just enough to
  // confirm "yes, this is the right round" before tapping Continue.
  const { data, error } = await supabase.rpc("get_guest_invitation_preview", { p_token: token });
  const preview = (error ? { status: "not_found" } : data) as {
    status: "not_found" | "revoked" | "expired" | "pending";
    guest_display_name?: string;
    group_name?: string | null;
    course_name?: string | null;
    round_date?: string | null;
  };

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
              <CardTitle>{preview.status === "pending" ? "You're invited to score a round" : "Guest invitation"}</CardTitle>
            </CardHeader>
            <CardContent>
              {preview.status === "not_found" && (
                <p className="text-sm text-charcoal-500">
                  This guest link isn&apos;t valid. Double-check the link, or ask the captain for a
                  new one.
                </p>
              )}

              {preview.status === "revoked" && (
                <p className="text-sm text-charcoal-500">
                  This guest link has been turned off. Ask the captain for a new one.
                </p>
              )}

              {preview.status === "expired" && (
                <p className="text-sm text-charcoal-500">
                  This guest link has expired. Ask the captain for a new one.
                </p>
              )}

              {!GUEST_SCORING_ENABLED && preview.status === "pending" && (
                <p className="text-sm text-charcoal-500">
                  Guest scoring isn&apos;t turned on for this app right now. Ask the captain to add
                  you the normal way instead.
                </p>
              )}

              {GUEST_SCORING_ENABLED && preview.status === "pending" && (
                <div className="space-y-5">
                  <div>
                    <p className="text-sm text-charcoal-500">You&apos;ve been invited to score</p>
                    {preview.group_name && <p className="mt-0.5 text-xl text-forest-900">{preview.group_name}</p>}
                    <p className="mt-1 text-sm text-charcoal-500">
                      {[preview.course_name, preview.round_date ? formatDate(preview.round_date) : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <GuestInviteResponse token={token} guestDisplayName={preview.guest_display_name ?? "Guest"} />
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
