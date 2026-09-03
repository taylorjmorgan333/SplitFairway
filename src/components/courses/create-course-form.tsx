"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { createCourseAction } from "@/actions/courses";
import type { ActionState } from "@/actions/auth";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

const initialState: ActionState = { status: "idle" };

function CreateButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Adding course…" : "Add course"}
    </Button>
  );
}

/**
 * Adding a course to the shared library. Every course starts 'pending'
 * (supabase/migrations/20260903030000_courses.sql) — the creator can use
 * it for their own rounds right away, and it becomes visible to other
 * golfers once an admin reviews and approves it. Nothing here is fetched
 * from any external course database.
 */
export function CreateCourseForm() {
  const [state, formAction] = useActionState(createCourseAction, initialState);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state.status === "error" && state.message && (
        <Alert variant="error">{state.message}</Alert>
      )}

      <FormField id="name" label="Course name" errors={state.fieldErrors?.name}>
        <Input name="name" placeholder="Pebble Beach Golf Links" required />
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="city" label="City" hint="Optional" errors={state.fieldErrors?.city}>
          <Input name="city" placeholder="Pebble Beach" />
        </FormField>
        <FormField id="state" label="State" hint="Optional" errors={state.fieldErrors?.state}>
          <Input name="state" placeholder="CA" />
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
        You&apos;ll add tee sets and hole-by-hole par, yardage, and stroke index next.
      </p>

      <CreateButton />
    </form>
  );
}
