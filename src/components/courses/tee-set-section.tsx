"use client";

import { useActionState, useState, useTransition } from "react";
import { deleteTeeSetAction, updateTeeSetRatingAction } from "@/actions/courses";
import type { ActionState } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { HolesGridForm } from "@/components/courses/holes-grid-form";
import type { Tables } from "@/lib/supabase/database.types";

const initialState: ActionState = { status: "idle" };

/**
 * Inline "enter or correct Rating and Slope" fallback for a saved tee
 * (course-management fallback, spec section 5) -- kept separate from
 * the always-visible summary line above it so a captain who's fine
 * with what's already there never sees an open text form. Only rendered
 * when `canEdit` is true, which already matches
 * course_tee_sets_update_own_or_admin exactly (tee-set-section's caller
 * computes it the same way RLS would decide), so nothing here grants
 * any golfer permission RLS wouldn't already allow.
 */
function EditRatingSlopeForm({
  courseId,
  teeSet,
  onDone,
}: {
  courseId: string;
  teeSet: Tables<"course_tee_sets">;
  onDone: () => void;
}) {
  const action = updateTeeSetRatingAction.bind(null, courseId, teeSet.id);
  const [state, formAction] = useActionState(action, initialState);

  return (
    <form action={formAction} className="mt-2 space-y-2 rounded-lg bg-cream-100 p-3">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor={`courseRating-${teeSet.id}`} className="mb-1 block text-xs font-medium text-forest-900">
            Course Rating
          </label>
          <input
            id={`courseRating-${teeSet.id}`}
            name="courseRating"
            type="text"
            inputMode="decimal"
            placeholder="e.g. 72.4"
            defaultValue={teeSet.course_rating ?? ""}
            className="h-10 w-full rounded-lg border border-charcoal-400/25 bg-white px-3 text-sm focus:border-forest-600"
          />
          {state.status === "error" && state.fieldErrors?.courseRating && (
            <p className="mt-1 text-xs text-red-600">{state.fieldErrors.courseRating[0]}</p>
          )}
        </div>
        <div>
          <label htmlFor={`slopeRating-${teeSet.id}`} className="mb-1 block text-xs font-medium text-forest-900">
            Slope Rating
          </label>
          <input
            id={`slopeRating-${teeSet.id}`}
            name="slopeRating"
            type="text"
            inputMode="numeric"
            placeholder="e.g. 131"
            defaultValue={teeSet.slope_rating ?? ""}
            className="h-10 w-full rounded-lg border border-charcoal-400/25 bg-white px-3 text-sm focus:border-forest-600"
          />
          {state.status === "error" && state.fieldErrors?.slopeRating && (
            <p className="mt-1 text-xs text-red-600">{state.fieldErrors.slopeRating[0]}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm">
          Save
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          Cancel
        </Button>
      </div>
      {state.status === "error" && state.message && <Alert variant="error">{state.message}</Alert>}
      {state.status === "success" && state.message && <Alert variant="success">{state.message}</Alert>}
    </form>
  );
}

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
  const [editingRating, setEditingRating] = useState(false);

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

  const hasRatingSlope = teeSet.course_rating != null && teeSet.slope_rating != null;

  return (
    <div className="rounded-lg border border-charcoal-400/15 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-medium text-forest-900">
            {teeSet.color ? `${teeSet.name} (${teeSet.color})` : teeSet.name}
          </h3>
          <p className="flex flex-wrap items-center gap-1.5 text-xs text-charcoal-400">
            <span>
              {[
                hasRatingSlope ? `Rating ${teeSet.course_rating} / Slope ${teeSet.slope_rating}` : "Rating and slope needed",
                teeSet.total_yards ? `${teeSet.total_yards} yds` : null,
                teeSet.category === "male"
                  ? "Men's"
                  : teeSet.category === "female"
                    ? "Women's"
                    : teeSet.category === "unisex"
                      ? "Unisex"
                      : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
            {teeSet.rating_source && (
              <Badge variant={teeSet.rating_source === "manual" ? "gold" : "forest"}>
                {teeSet.rating_source === "manual" ? "Manually entered" : "From GolfCourseAPI"}
              </Badge>
            )}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {canEdit && !editingRating && (
            <Button variant="ghost" size="sm" onClick={() => setEditingRating(true)}>
              {hasRatingSlope ? "Edit rating/slope" : "Add rating and slope"}
            </Button>
          )}
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
      </div>
      {canEdit && editingRating && (
        <EditRatingSlopeForm courseId={courseId} teeSet={teeSet} onDone={() => setEditingRating(false)} />
      )}
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
