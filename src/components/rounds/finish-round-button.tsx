"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { lockRoundAction } from "@/actions/scores";
import { Button } from "@/components/ui/button";

/**
 * The captain's actual "lock this round" action, lived on the
 * scorecard until now as a button labeled "Lock round" -- confusing
 * next to a scorecard someone might still be actively entering scores
 * into. Moved here, to the Results page a captain reaches by tapping
 * "Review & Finish" on the scorecard, so locking follows an actual
 * review step instead of firing straight from the entry screen.
 * lockRoundAction itself is untouched -- only which screen calls it
 * has moved. When this round is linked to a saved group, locking now
 * sends the captain straight to that round's Group Recap (spec item 7)
 * instead of just re-rendering this same page -- every other round's
 * behavior (groupId null) is unchanged.
 */
export function FinishRoundButton({
  tripId,
  roundId,
  groupId,
}: {
  tripId: string;
  roundId: string;
  groupId?: string | null;
}) {
  const router = useRouter();
  const [isLocking, setIsLocking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="mt-4">
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      <Button
        variant="outline"
        disabled={isLocking}
        className="border-red-200 text-red-700 hover:bg-red-50"
        onClick={() => {
          if (!window.confirm("Lock this round? No one will be able to change scores after this.")) return;
          setIsLocking(true);
          setError(null);
          lockRoundAction(tripId, roundId)
            .then(() => {
              if (groupId) {
                router.push(`/trips/${tripId}/rounds/${roundId}/recap`);
              }
            })
            .catch((err) => {
              setError(err instanceof Error ? err.message : "Couldn't lock the round.");
            })
            .finally(() => setIsLocking(false));
        }}
      >
        {isLocking ? "Locking…" : "Lock Round"}
      </Button>
    </div>
  );
}
