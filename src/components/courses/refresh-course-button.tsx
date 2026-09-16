"use client";

import { useState, useTransition } from "react";
import { refreshExternalCourseAction } from "@/actions/course-import";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

/** Admin-only. Re-fetches this course's tee/hole data from GolfCourseAPI and replaces the shared library row -- never touches any round that already exists (see the comment on refreshExternalCourseAction). */
export function RefreshCourseButton({ courseId }: { courseId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [preservedManualTees, setPreservedManualTees] = useState<string[]>([]);

  function handleRefresh() {
    setError(null);
    startTransition(async () => {
      const result = await refreshExternalCourseAction(courseId);
      if (result.ok) {
        setDone(true);
        setPreservedManualTees(result.preservedManualTees);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="space-y-2">
      <Button type="button" variant="outline" size="sm" disabled={isPending} onClick={handleRefresh}>
        {isPending ? "Refreshing…" : "Refresh from GolfCourseAPI"}
      </Button>
      {done && (
        <Alert variant="success">
          Refreshed. Existing rounds are unaffected.
          {preservedManualTees.length > 0 && (
            <>
              {" "}
              Kept your manually entered rating/slope for {preservedManualTees.join(", ")} — the
              refresh did not overwrite it.
            </>
          )}
        </Alert>
      )}
      {error && <Alert variant="error">{error}</Alert>}
    </div>
  );
}
