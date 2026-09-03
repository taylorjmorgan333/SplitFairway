"use client";

import { useState, useTransition } from "react";
import { reviewCourseCorrectionAction } from "@/actions/course-corrections";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

export function CorrectionReviewActions({ correctionId }: { correctionId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<"approved" | "rejected" | null>(null);

  function handle(decision: "approved" | "rejected") {
    setError(null);
    startTransition(async () => {
      const result = await reviewCourseCorrectionAction(correctionId, decision);
      if (result.ok) {
        setDone(decision);
      } else {
        setError(result.error);
      }
    });
  }

  if (done) {
    return <p className="text-xs text-charcoal-400">Marked {done}.</p>;
  }

  return (
    <div className="flex items-center gap-2">
      <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={() => handle("approved")}>
        Approve
      </Button>
      <Button type="button" size="sm" variant="ghost" disabled={isPending} onClick={() => handle("rejected")}>
        Reject
      </Button>
      {error && <Alert variant="error">{error}</Alert>}
    </div>
  );
}
