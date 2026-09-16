"use client";

import { useState, useTransition } from "react";
import { refreshRoundTeeDataAction } from "@/actions/rounds";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

/**
 * Captain-only fallback for a round whose saved tee data is missing
 * Rating/Slope (spec section 4) -- pulls just the missing values in
 * from the course library without touching anything the round already
 * has, any scores, or any manual Playing Handicap override. See
 * refreshRoundTeeDataAction (src/actions/rounds.ts) for the full
 * behavior; only rendered by the caller when at least one snapshot tee
 * is actually missing a Rating or Slope.
 */
export function RefreshRoundTeeDataButton({ roundId }: { roundId: string }) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: true; message: string } | { ok: false; error: string } | null>(null);

  function handleRefresh() {
    setResult(null);
    startTransition(async () => {
      const outcome = await refreshRoundTeeDataAction(roundId);
      if (!outcome.ok) {
        setResult({ ok: false, error: outcome.error });
        return;
      }
      if (outcome.updatedTeeNames.length === 0) {
        setResult({ ok: true, message: "Nothing to refresh — the course library doesn't have that data either." });
        return;
      }
      const teeList = outcome.updatedTeeNames.join(", ");
      const recalcNote =
        outcome.recalculatedPlayerCount > 0
          ? ` Recalculated the Course Handicap for ${outcome.recalculatedPlayerCount} golfer${outcome.recalculatedPlayerCount === 1 ? "" : "s"} who had none yet.`
          : "";
      setResult({ ok: true, message: `Filled in Rating/Slope for ${teeList}.${recalcNote}` });
    });
  }

  return (
    <div className="mt-2 space-y-2">
      <Button type="button" variant="outline" size="sm" disabled={isPending} onClick={handleRefresh}>
        {isPending ? "Refreshing…" : "Refresh missing tee data from course"}
      </Button>
      {result && (
        <Alert variant={result.ok ? "success" : "error"}>{result.ok ? result.message : result.error}</Alert>
      )}
    </div>
  );
}
