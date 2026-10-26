import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import {
  firstMatchingInvite,
  invitePath,
  isStoredInviteToken,
  type InvitePreview,
} from "@/lib/join/resolve-invite";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Join",
  description: "Open a SplitFairway invite link.",
  robots: { index: false, follow: false },
};

function JoinShell({ children }: { children: React.ReactNode }) {
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
              <CardTitle>Invitation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">{children}</CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default async function JoinPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const token = decodeURIComponent(code).trim();

  if (!isStoredInviteToken(token)) {
    return (
      <JoinShell>
        <p className="text-sm text-charcoal-500">
          This invite link isn&apos;t valid. Ask the person who sent it for a new one.
        </p>
        <ButtonLink href="/signup">Create a free account</ButtonLink>
      </JoinShell>
    );
  }

  let kind: ReturnType<typeof firstMatchingInvite> = null;
  let lookupFailed = false;

  try {
    const supabase = await createClient();
    const [trip, group, guest] = await Promise.all([
      supabase.rpc("get_invitation_preview", { p_token: token }),
      supabase.rpc("get_group_invitation_preview", { p_token: token }),
      supabase.rpc("get_guest_invitation_preview", { p_token: token }),
    ]);

    if (trip.error && group.error && guest.error) {
      lookupFailed = true;
    } else {
      kind = firstMatchingInvite({
        trip: trip.data as InvitePreview | null,
        group: group.data as InvitePreview | null,
        guest: guest.data as InvitePreview | null,
      });
    }
  } catch {
    lookupFailed = true;
  }

  if (kind) {
    redirect(invitePath(kind, token));
  }

  return (
    <JoinShell>
      <p className="text-sm text-charcoal-500">
        {lookupFailed
          ? "We couldn't check this invite just now. Open the link again in a moment."
          : "This invite link isn't valid. Ask the person who sent it for a new one."}
      </p>
      <ButtonLink href="/signup">Create a free account</ButtonLink>
    </JoinShell>
  );
}
