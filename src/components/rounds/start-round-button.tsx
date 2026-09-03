"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { startRoundAction } from "@/actions/scores";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

/**
 * "Start Round" on the Review step. Calls the same startRoundAction the
 * mobile scorecard already uses to flip scheduled -> in_progress, then
 * sends the captain straight into score entry -- the redesign's "one
 * obvious next action" principle applied to the moment play actually
 * begins.
 */
export function StartRoundButton({
  tripId,
  roundId,
  disabled,
}: {
  tripId: string;
  roundId: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      {error && (
        <Alert variant="error" className="mb-3">
          {error}
        </Alert>
      )}
      <Button
        type="button"
        size="lg"
        disabled={disabled || isPending}
        className="flex w-full justify-center"
        onClick={() => {
          setError(null);
          startTransition(async () => {
            try {
              await startRoundAction(tripId, roundId);
              router.push(`/trips/${tripId}/rounds/${roundId}/score`);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Couldn't start this round. Please try again.");
            }
          });
        }}
      >
        {isPending ? "Starting round…" : "Start Round"}
      </Button>
    </div>
  );
}
