"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { submitCourseCorrectionAction } from "@/actions/course-corrections";
import { ISSUE_TYPE_VALUES, ISSUE_TYPE_LABELS } from "@/lib/validation/course-correction";
import type { ActionState } from "@/actions/auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

const initialState: ActionState = { status: "idle" };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="outline" size="sm" disabled={pending}>
      {pending ? "Submitting…" : "Submit report"}
    </Button>
  );
}

/**
 * Lets any signed-in golfer flag a problem with a course's data without
 * ever being able to change the shared record themselves -- this posts
 * to course_corrections for admin review (submitCourseCorrectionAction),
 * never directly to courses/course_tee_sets/course_holes. Shown in place
 * of the direct-edit forms for a course this user didn't create, and
 * always shown (alongside admin edit access) for provider-imported
 * courses, which nobody but an admin can edit directly regardless of who
 * imported them.
 */
export function CourseCorrectionForm({ courseId }: { courseId: string }) {
  const action = submitCourseCorrectionAction.bind(null, courseId);
  const [state, formAction] = useActionState(action, initialState);
  const [open, setOpen] = useState(false);

  if (state.status === "success") {
    return <Alert variant="success">{state.message}</Alert>;
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm text-charcoal-500 underline underline-offset-2"
      >
        Report an issue with this course
      </button>
    );
  }

  return (
    <form action={formAction} className="space-y-3 rounded-lg border border-charcoal-400/15 p-4">
      <p className="text-sm font-medium text-charcoal-800">Report an issue</p>

      <div>
        <Label htmlFor="issueType">What&apos;s wrong?</Label>
        <select
          id="issueType"
          name="issueType"
          defaultValue={ISSUE_TYPE_VALUES[0]}
          className="mt-1 h-11 w-full rounded-lg border border-charcoal-400/25 bg-white px-3.5 text-sm text-charcoal focus:border-forest-600"
        >
          {ISSUE_TYPE_VALUES.map((v) => (
            <option key={v} value={v}>
              {ISSUE_TYPE_LABELS[v]}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="holeNumber">Hole (if applicable)</Label>
          <Input id="holeNumber" name="holeNumber" type="number" min="1" max="18" />
        </div>
        <div>
          <Label htmlFor="currentValue">Current value</Label>
          <Input id="currentValue" name="currentValue" placeholder="e.g. Par 4" />
        </div>
      </div>

      <div>
        <Label htmlFor="proposedValue">What it should be</Label>
        <Input id="proposedValue" name="proposedValue" placeholder="e.g. Par 5" />
      </div>

      <div>
        <Label htmlFor="reason">Details</Label>
        <textarea
          id="reason"
          name="reason"
          required
          rows={3}
          className="mt-1 w-full rounded-lg border border-charcoal-400/25 bg-white px-3.5 py-2 text-sm text-charcoal focus:border-forest-600"
        />
        {state.status === "error" && state.fieldErrors?.reason && (
          <p className="mt-1 text-xs text-red-600">{state.fieldErrors.reason[0]}</p>
        )}
      </div>

      {state.status === "error" && state.message && <Alert variant="error">{state.message}</Alert>}

      <div className="flex items-center gap-2">
        <SubmitButton />
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-charcoal-400 underline underline-offset-2"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
