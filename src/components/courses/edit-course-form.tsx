"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { updateCourseAction } from "@/actions/courses";
import type { ActionState } from "@/actions/auth";
import type { Tables } from "@/lib/supabase/database.types";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

const initialState: ActionState = { status: "idle" };

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="outline" disabled={pending}>
      {pending ? "Saving…" : "Save details"}
    </Button>
  );
}

export function EditCourseForm({ course }: { course: Tables<"courses"> }) {
  const action = updateCourseAction.bind(null, course.id);
  const [state, formAction] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state.status === "error" && state.message && (
        <Alert variant="error">{state.message}</Alert>
      )}
      {state.status === "success" && state.message && (
        <Alert variant="success">{state.message}</Alert>
      )}

      <FormField id="name" label="Course name" errors={state.fieldErrors?.name}>
        <Input name="name" defaultValue={course.name} required />
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="city" label="City" hint="Optional" errors={state.fieldErrors?.city}>
          <Input name="city" defaultValue={course.city ?? ""} />
        </FormField>
        <FormField id="state" label="State" hint="Optional" errors={state.fieldErrors?.state}>
          <Input name="state" defaultValue={course.state ?? ""} />
        </FormField>
      </div>

      <div>
        <Label htmlFor="holeCount">Holes</Label>
        <select
          id="holeCount"
          name="holeCount"
          defaultValue={String(course.hole_count)}
          className="h-11 w-full rounded-lg border border-charcoal-400/25 bg-white px-3.5 text-sm text-charcoal transition-colors focus:border-forest-600"
        >
          <option value="18">18 holes</option>
          <option value="9">9 holes</option>
        </select>
      </div>

      <SaveButton />
    </form>
  );
}
