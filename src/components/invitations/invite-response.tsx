"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { acceptInvitationAction, declineInvitationAction } from "@/actions/invitations";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

export function InviteResponse({ token }: { token: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [declined, setDeclined] = useState(false);

  function handleAccept() {
    setError(null);
    startTransition(async () => {
      try {
        const { tripId } = await acceptInvitationAction(token);
        router.push(`/trips/${tripId}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not accept this invitation.");
      }
    });
  }

  function handleDecline() {
    if (!window.confirm("Decline this invitation? You won't be added to the trip.")) {
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await declineInvitationAction(token);
        setDeclined(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not decline this invitation.");
      }
    });
  }

  if (declined) {
    return <Alert variant="info">You&apos;ve declined this invitation. No hard feelings.</Alert>;
  }

  return (
    <div className="space-y-4">
      {error && <Alert variant="error">{error}</Alert>}
      <div className="flex flex-wrap gap-3">
        <Button onClick={handleAccept} disabled={isPending}>
          {isPending ? "Working…" : "Accept invitation"}
        </Button>
        <Button variant="outline" onClick={handleDecline} disabled={isPending}>
          Decline
        </Button>
      </div>
    </div>
  );
}
