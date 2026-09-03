"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { createRoundAction } from "@/actions/rounds";
import type { ActionState } from "@/actions/auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormField } from "@/components/ui/form-field";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

const initialState: ActionState = { status: "idle" };

function CreateButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Scheduling…" : "Schedule round"}
    </Button>
  );
}

export function CreateRoundForm({
  tripId,
  courses,
}: {
  tripId: string;
  courses: { id: string; name: string; hole_count: number }[];
}) {
  const action = createRoundAction.bind(null, tripId);
  const [state, formAction] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state.status === "error" && state.message && (
        <Alert variant="error">{state.message}</Alert>
      )}

      <div>
        <Label htmlFor="courseId">Course</Label>
        <select
          id="courseId"
          name="courseId"
          className="h-11 w-full rounded-lg border border-charcoal-400/25 bg-white px-3.5 text-sm text-charcoal transition-colors focus:border-forest-600"
          required
          defaultValue=""
        >
          <option value="" disabled>
            Choose a course
          </option>
          {courses.map((course) => (
            <option key={course.id} value={course.id}>
              {course.name} ({course.hole_count} holes)
            </option>
          ))}
        </select>
        {state.status === "error" && state.fieldErrors?.courseId && (
          <p className="mt-1.5 text-xs text-red-600">{state.fieldErrors.courseId[0]}</p>
        )}
        {courses.length === 0 && (
          <p className="mt-1.5 text-xs text-charcoal-400">
            No courses yet — add one to your course library first.
          </p>
        )}
      </div>

      <FormField id="name" label="Round name" hint="Optional, e.g. “Round 1”" errors={state.fieldErrors?.name}>
        <Input name="name" placeholder="Round 1" />
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="roundDate" label="Date" errors={state.fieldErrors?.roundDate}>
          <Input name="roundDate" type="date" required />
        </FormField>
        <FormField id="startTime" label="Start time" hint="Optional" errors={state.fieldErrors?.startTime}>
          <Input name="startTime" type="time" />
        </FormField>
      </div>

      <div>
        <Label htmlFor="holeCount">Holes</Label>
        <select
          id="holeCount"
          name="holeCount"
          defaultValue="18"
          className="h-11 w-full rounded-lg border border-charcoal-400/25 bg-white px-3.5 text-sm text-charcoal transition-colors focus:border-forest-600"
        >
          <option value="18">18 holes</option>
          <option value="9">9 holes</option>
        </select>
      </div>

      <p className="text-xs text-charcoal-400">
        The course&apos;s tee sets and scorecard are copied into this round when it&apos;s created — later
        edits to the course won&apos;t change this round.
      </p>

      <CreateButton />
    </form>
  );
}
