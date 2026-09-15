"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { acceptGroupInvitationAction } from "@/actions/group-invitations";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

export function GroupInviteResponse({ token }: { token: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleAccept() {
    setError(null);
    startTransition(async () => {
      try {
        const { redirectPath } = await acceptGroupInvitationAction(token);
        router.push(redirectPath);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not accept this invitation.");
      }
    });
  }

  return (
    <div className="space-y-4">
      {error && <Alert variant="error">{error}</Alert>}
      <Button onClick={handleAccept} disabled={isPending}>
        {isPending ? "Joining…" : "Accept and join"}
      </Button>
    </div>
  );
}
