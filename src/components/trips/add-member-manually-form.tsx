"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { addMemberManuallyAction } from "@/actions/members";
import type { ActionState } from "@/actions/auth";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

const initialState: ActionState = { status: "idle" };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant="outline" disabled={pending}>
      {pending ? "Adding…" : "Add golfer"}
    </Button>
  );
}

/**
 * The no-invitation path: a captain who has someone's name (and maybe
 * not much else) can add them straight in as an active golfer, no
 * email required and nothing for the golfer to accept. Deliberately
 * simpler than InviteMemberForm — no role picker, no invite link to
 * copy — since the point is speed for people who won't check an
 * inbox. The email field is a courtesy for the captain's own records;
 * if it's filled in, the same person can still be sent a real invite
 * later from the form above to give them their own login.
 */
export function AddMemberManuallyForm({ tripId }: { tripId: string }) {
  const boundAction = addMemberManuallyAction.bind(null, tripId);
  const [state, formAction] = useActionState(boundAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state.status]);

  return (
    <form ref={formRef} action={formAction} className="space-y-4" noValidate>
      {state.status === "error" && state.message && <Alert variant="error">{state.message}</Alert>}
      {state.status === "success" && state.message && <Alert variant="success">{state.message}</Alert>}

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="manualDisplayName" label="Name" errors={state.fieldErrors?.displayName}>
          <Input id="manualDisplayName" name="displayName" type="text" placeholder="Golfer's name" required />
        </FormField>
        <FormField id="manualEmail" label="Email (optional)" errors={state.fieldErrors?.email}>
          <Input id="manualEmail" name="email" type="email" placeholder="them@example.com" />
        </FormField>
      </div>

      <SubmitButton />
    </form>
  );
}
