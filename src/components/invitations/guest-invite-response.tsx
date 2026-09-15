"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { redeemGuestInvitationAction } from "@/actions/guest-invitations";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

/**
 * The entire guest onboarding step: one tap, no form fields at all.
 * redeemGuestInvitationAction does the (possibly) anonymous sign-in
 * and the token redemption together, then this just navigates to the
 * scorecard it returns -- "open directly to the appropriate
 * scorecard" (spec item 1), no dashboard in between.
 */
export function GuestInviteResponse({ token, guestDisplayName }: { token: string; guestDisplayName: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleContinue() {
    setError(null);
    startTransition(async () => {
      try {
        const { redirectPath } = await redeemGuestInvitationAction(token);
        router.push(redirectPath);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't open that guest link.");
      }
    });
  }

  return (
    <div className="space-y-4">
      {error && <Alert variant="error">{error}</Alert>}
      <Button onClick={handleContinue} disabled={isPending} size="lg" className="w-full">
        {isPending ? "Getting your scorecard ready…" : `Continue as ${guestDisplayName}`}
      </Button>
      <p className="text-xs text-charcoal-400">
        No account or password needed. You can create an account afterward to save your history.
      </p>
    </div>
  );
}
