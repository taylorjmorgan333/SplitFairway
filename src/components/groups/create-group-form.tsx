"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { createGroupAction } from "@/actions/groups";
import type { ActionState } from "@/actions/auth";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

const initialState: ActionState = { status: "idle" };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending ? "Creating group…" : "Create group"}
    </Button>
  );
}

export function CreateGroupForm() {
  const [state, formAction] = useActionState(createGroupAction, initialState);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {state.status === "error" && state.message && <Alert variant="error">{state.message}</Alert>}

      <FormField id="name" label="Group name" errors={state.fieldErrors?.name}>
        <Input name="name" type="text" placeholder="e.g. Saturday Regulars" required />
      </FormField>

      <FormField
        id="description"
        label="Notes"
        errors={state.fieldErrors?.description}
        hint="Optional — a reminder of who this group is, visible to its members."
      >
        <textarea
          name="description"
          rows={3}
          className="w-full rounded-lg border border-charcoal-400/25 bg-white px-3.5 py-2.5 text-base text-charcoal placeholder:text-charcoal-400 transition-colors focus:border-forest-600"
          placeholder="e.g. The regular Saturday morning group at Pine Hollow"
        />
      </FormField>

      <SubmitButton />
    </form>
  );
}
