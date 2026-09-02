"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { createTripAction } from "@/actions/trips";
import type { ActionState } from "@/actions/auth";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

const initialState: ActionState = { status: "idle" };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Creating trip…" : "Create trip"}
    </Button>
  );
}

export function CreateTripForm() {
  const [state, formAction] = useActionState(createTripAction, initialState);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {state.status === "error" && state.message && (
        <Alert variant="error">{state.message}</Alert>
      )}

      <FormField id="name" label="Trip name" errors={state.fieldErrors?.name}>
        <Input name="name" type="text" placeholder="e.g. Pebble Ridge Fall Trip" required />
      </FormField>

      <FormField id="destination" label="Destination" errors={state.fieldErrors?.destination}>
        <Input name="destination" type="text" placeholder="e.g. Bandon, OR" />
      </FormField>

      <div className="grid grid-cols-2 gap-4">
        <FormField id="startDate" label="Start date" errors={state.fieldErrors?.startDate}>
          <Input name="startDate" type="date" />
        </FormField>
        <FormField id="endDate" label="End date" errors={state.fieldErrors?.endDate}>
          <Input name="endDate" type="date" />
        </FormField>
      </div>

      <FormField
        id="description"
        label="Notes"
        errors={state.fieldErrors?.description}
        hint="Optional — visible to everyone on the trip."
      >
        <textarea
          name="description"
          rows={3}
          className="w-full rounded-lg border border-charcoal-400/25 bg-white px-3.5 py-2.5 text-sm text-charcoal placeholder:text-charcoal-400 transition-colors focus:border-forest-600"
          placeholder="Anything the group should know up front"
        />
      </FormField>

      <SubmitButton />
    </form>
  );
}
