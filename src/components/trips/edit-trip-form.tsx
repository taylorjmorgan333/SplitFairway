"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { updateTripAction } from "@/actions/trips";
import type { ActionState } from "@/actions/auth";
import type { Tables } from "@/lib/supabase/database.types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormField } from "@/components/ui/form-field";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

const initialState: ActionState = { status: "idle" };

const STATUS_OPTIONS: { value: Tables<"trips">["status"]; label: string }[] = [
  { value: "planning", label: "Planning" },
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled / archived" },
];

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : "Save changes"}
    </Button>
  );
}

export function EditTripForm({ trip }: { trip: Tables<"trips"> }) {
  const boundAction = updateTripAction.bind(null, trip.id);
  const [state, formAction] = useActionState(boundAction, initialState);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {state.status === "error" && state.message && (
        <Alert variant="error">{state.message}</Alert>
      )}
      {state.status === "success" && state.message && (
        <Alert variant="success">{state.message}</Alert>
      )}

      <FormField id="name" label="Trip name" errors={state.fieldErrors?.name}>
        <Input name="name" type="text" defaultValue={trip.name} required />
      </FormField>

      <FormField id="destination" label="Destination" errors={state.fieldErrors?.destination}>
        <Input name="destination" type="text" defaultValue={trip.destination ?? ""} />
      </FormField>

      <div className="grid grid-cols-2 gap-4">
        <FormField id="startDate" label="Start date" errors={state.fieldErrors?.startDate}>
          <Input name="startDate" type="date" defaultValue={trip.start_date ?? ""} />
        </FormField>
        <FormField id="endDate" label="End date" errors={state.fieldErrors?.endDate}>
          <Input name="endDate" type="date" defaultValue={trip.end_date ?? ""} />
        </FormField>
      </div>

      <FormField
        id="description"
        label="Notes"
        errors={state.fieldErrors?.description}
        hint="Visible to everyone on the trip."
      >
        <textarea
          name="description"
          rows={3}
          defaultValue={trip.description ?? ""}
          className="w-full rounded-lg border border-charcoal-400/25 bg-white px-3.5 py-2.5 text-sm text-charcoal placeholder:text-charcoal-400 transition-colors focus:border-forest-600"
        />
      </FormField>

      <div>
        <Label htmlFor="status">Status</Label>
        <select
          id="status"
          name="status"
          defaultValue={trip.status}
          className="h-11 w-full rounded-lg border border-charcoal-400/25 bg-white px-3.5 text-sm text-charcoal transition-colors focus:border-forest-600"
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <SubmitButton />
    </form>
  );
}
