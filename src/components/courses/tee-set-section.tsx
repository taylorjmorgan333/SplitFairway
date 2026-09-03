"use client";

import { useState, useTransition } from "react";
import { deleteTeeSetAction } from "@/actions/courses";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { HolesGridForm } from "@/components/courses/holes-grid-form";
import type { Tables } from "@/lib/supabase/database.types";

export function TeeSetSection({
  courseId,
  teeSet,
  holeCount,
  holes,
  canEdit,
}: {
  courseId: string;
  teeSet: Tables<"course_tee_sets">;
  holeCount: number;
  holes: Tables<"course_holes">[];
  canEdit: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [removed, setRemoved] = useState(false);

  function handleDelete() {
    if (!window.confirm(`Remove the "${teeSet.name}" tee set and its scorecard?`)) return;
    setError(null);
    startTransition(async () => {
      try {
        await deleteTeeSetAction(courseId, teeSet.id);
        setRemoved(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't remove that tee set.");
      }
    });
  }

  if (removed) return null;

  return (
    <div className="rounded-lg border border-charcoal-400/15 p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-medium text-forest-900">{teeSet.name}</h3>
        {canEdit && (
          <Button
            variant="ghost"
            size="sm"
            disabled={isPending}
            onClick={handleDelete}
            className="text-red-700 hover:bg-red-50"
          >
            {isPending ? "Removing…" : "Remove tee set"}
          </Button>
        )}
      </div>
      {error && (
        <Alert variant="error" className="mt-2">
          {error}
        </Alert>
      )}
      <div className="mt-3">
        {canEdit ? (
          <HolesGridForm
            courseId={courseId}
            teeSetId={teeSet.id}
            holeCount={holeCount}
            existingHoles={holes}
          />
        ) : holes.length > 0 ? (
          <p className="text-sm text-charcoal-500">{holes.length} holes entered.</p>
        ) : (
          <p className="text-sm text-charcoal-400">No scorecard entered yet.</p>
        )}
      </div>
    </div>
  );
}
