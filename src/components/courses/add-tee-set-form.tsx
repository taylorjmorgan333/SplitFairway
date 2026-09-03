"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { createTeeSetAction } from "@/actions/courses";
import type { ActionState } from "@/actions/auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

const initialState: ActionState = { status: "idle" };

function AddButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="outline" size="sm" disabled={pending}>
      {pending ? "Adding…" : "Add tee set"}
    </Button>
  );
}

export function AddTeeSetForm({ courseId }: { courseId: string }) {
  const action = createTeeSetAction.bind(null, courseId);
  const [state, formAction] = useActionState(action, initialState);
  const [showDetails, setShowDetails] = useState(false);

  return (
    <form action={formAction} className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[10rem]">
          <label htmlFor="teeSetName" className="text-xs font-medium text-charcoal-500">
            Tee name
          </label>
          <Input id="teeSetName" name="name" placeholder="White" className="mt-1" required />
          {state.status === "error" && state.fieldErrors?.name && (
            <p className="mt-1 text-xs text-red-600">{state.fieldErrors.name[0]}</p>
          )}
        </div>
        <AddButton />
        <button
          type="button"
          onClick={() => setShowDetails((v) => !v)}
          className="text-xs text-charcoal-400 underline underline-offset-2"
        >
          {showDetails ? "Hide" : "Add"} rating &amp; slope
        </button>
      </div>

      {showDetails && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <label htmlFor="teeSetColor" className="text-xs font-medium text-charcoal-500">
              Color
            </label>
            <Input id="teeSetColor" name="color" placeholder="Blue" className="mt-1" />
          </div>
          <div>
            <label htmlFor="teeSetCategory" className="text-xs font-medium text-charcoal-500">
              Tees
            </label>
            <select
              id="teeSetCategory"
              name="category"
              defaultValue=""
              className="mt-1 h-11 w-full rounded-lg border border-charcoal-400/25 bg-white px-3.5 text-sm text-charcoal focus:border-forest-600"
            >
              <option value="">Not specified</option>
              <option value="unisex">Unisex</option>
              <option value="male">Men&apos;s</option>
              <option value="female">Women&apos;s</option>
            </select>
          </div>
          <div>
            <label htmlFor="teeSetCourseRating" className="text-xs font-medium text-charcoal-500">
              Course rating
            </label>
            <Input
              id="teeSetCourseRating"
              name="courseRating"
              type="number"
              step="0.1"
              min="50"
              max="100"
              placeholder="72.4"
              className="mt-1"
            />
          </div>
          <div>
            <label htmlFor="teeSetSlopeRating" className="text-xs font-medium text-charcoal-500">
              Slope rating
            </label>
            <Input
              id="teeSetSlopeRating"
              name="slopeRating"
              type="number"
              min="1"
              max="200"
              placeholder="130"
              className="mt-1"
            />
          </div>
          <div>
            <label htmlFor="teeSetTotalYards" className="text-xs font-medium text-charcoal-500">
              Total yards
            </label>
            <Input
              id="teeSetTotalYards"
              name="totalYards"
              type="number"
              min="1"
              placeholder="6820"
              className="mt-1"
            />
          </div>
        </div>
      )}

      {state.status === "error" && state.message && <Alert variant="error">{state.message}</Alert>}
      {state.status === "error" && state.fieldErrors && !state.fieldErrors.name && (
        <Alert variant="error">{Object.values(state.fieldErrors).flat().join(" ")}</Alert>
      )}
    </form>
  );
}
