"use client";

import { useActionState, useRef, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { addGroupMemberAction, updateGroupMemberAction } from "@/actions/groups";
import type { ActionState } from "@/actions/auth";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

const initialState: ActionState = { status: "idle" };

export interface GroupMemberInitialValues {
  id: string;
  displayName: string;
  email: string | null;
  defaultHandicapIndex: number | null;
  preferredTeeName: string | null;
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={pending}>
      {pending ? "Saving…" : label}
    </Button>
  );
}

/** Adds a new saved golfer, or (with initialValues) edits an existing one in place -- same fields either way, per spec item 5. */
export function AddGroupMemberForm({
  groupId,
  initialValues,
  onSaved,
}: {
  groupId: string;
  initialValues?: GroupMemberInitialValues;
  onSaved?: () => void;
}) {
  const isEdit = Boolean(initialValues);
  const action = isEdit
    ? updateGroupMemberAction.bind(null, groupId, initialValues!.id)
    : addGroupMemberAction.bind(null, groupId);
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
    <form ref={formRef} action={formAction} className="space-y-5" noValidate>
      {state.status === "error" && state.message && <Alert variant="error">{state.message}</Alert>}

      <FormField id="displayName" label="Name" errors={state.fieldErrors?.displayName}>
        <Input name="displayName" type="text" placeholder="e.g. Dave Martinez" required defaultValue={initialValues?.displayName} />
      </FormField>

      <FormField
        id="email"
        label="Email"
        errors={state.fieldErrors?.email}
        hint="Optional — leave blank for a golfer who won't use the app."
      >
        <Input name="email" type="email" placeholder="dave@email.com" defaultValue={initialValues?.email ?? undefined} />
      </FormField>

      <div className="grid grid-cols-2 gap-4">
        <FormField
          id="defaultHandicapIndex"
          label="Handicap"
          errors={state.fieldErrors?.defaultHandicapIndex}
          hint="Optional"
        >
          <Input
            name="defaultHandicapIndex"
            type="number"
            step="0.1"
            min="-10"
            max="54"
            placeholder="e.g. 12.4"
            defaultValue={initialValues?.defaultHandicapIndex ?? undefined}
          />
        </FormField>
        <FormField
          id="preferredTeeName"
          label="Preferred tee"
          errors={state.fieldErrors?.preferredTeeName}
          hint="Optional"
        >
          <Input name="preferredTeeName" type="text" placeholder="e.g. White" defaultValue={initialValues?.preferredTeeName ?? undefined} />
        </FormField>
      </div>

      <p className="text-sm text-charcoal-500">
        Changing a handicap here only affects future rounds -- every round already played keeps its
        own permanent handicap snapshot.
      </p>

      <SubmitButton label={isEdit ? "Save Changes" : "Add Golfer"} />
    </form>
  );
}
