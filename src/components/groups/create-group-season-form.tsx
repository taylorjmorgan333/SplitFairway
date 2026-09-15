"use client";

import { useActionState, useRef, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { createGroupSeasonAction } from "@/actions/groups";
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
      {pending ? "Saving…" : "Create Season"}
    </Button>
  );
}

/** Owner-only custom season (spec item 4: "allowing captains to create a custom season") -- a group with none of these just uses the calendar year (resolveCurrentSeason). */
export function CreateGroupSeasonForm({ groupId, onSaved }: { groupId: string; onSaved?: () => void }) {
  const action = createGroupSeasonAction.bind(null, groupId);
  const [state, formAction] = useActionState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
      onSaved?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="space-y-4" noValidate>
      {state.status === "error" && state.message && <Alert variant="error">{state.message}</Alert>}

      <FormField id="name" label="Season name" errors={state.fieldErrors?.name}>
        <Input name="name" type="text" placeholder="e.g. Summer League 2026" required />
      </FormField>

      <div className="grid grid-cols-2 gap-4">
        <FormField id="startDate" label="Start date" errors={state.fieldErrors?.startDate}>
          <Input name="startDate" type="date" required />
        </FormField>
        <FormField id="endDate" label="End date" errors={state.fieldErrors?.endDate}>
          <Input name="endDate" type="date" required />
        </FormField>
      </div>

      <SubmitButton />
    </form>
  );
}
