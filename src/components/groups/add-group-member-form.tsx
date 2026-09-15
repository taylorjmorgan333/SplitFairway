"use client";

import { useActionState, useRef, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { addGroupMemberAction } from "@/actions/groups";
import type { ActionState } from "@/actions/auth";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

const initialState: ActionState = { status: "idle" };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={pending}>
      {pending ? "Adding…" : "Add Golfer"}
    </Button>
  );
}

export function AddGroupMemberForm({ groupId }: { groupId: string }) {
  const action = addGroupMemberAction.bind(null, groupId);
  const [state, formAction] = useActionState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="space-y-5" noValidate>
      {state.status === "error" && state.message && <Alert variant="error">{state.message}</Alert>}

      <FormField id="displayName" label="Name" errors={state.fieldErrors?.displayName}>
        <Input name="displayName" type="text" placeholder="e.g. Dave Martinez" required />
      </FormField>

      <FormField
        id="email"
        label="Email"
        errors={state.fieldErrors?.email}
        hint="Optional — leave blank for a golfer who won't use the app."
      >
        <Input name="email" type="email" placeholder="dave@email.com" />
      </FormField>

      <div className="grid grid-cols-2 gap-4">
        <FormField
          id="defaultHandicapIndex"
          label="Handicap"
          errors={state.fieldErrors?.defaultHandicapIndex}
          hint="Optional"
        >
          <Input name="defaultHandicapIndex" type="number" step="0.1" min="-10" max="54" placeholder="e.g. 12.4" />
        </FormField>
        <FormField
          id="preferredTeeName"
          label="Preferred tee"
          errors={state.fieldErrors?.preferredTeeName}
          hint="Optional"
        >
          <Input name="preferredTeeName" type="text" placeholder="e.g. White" />
        </FormField>
      </div>

      <SubmitButton />
    </form>
  );
}
