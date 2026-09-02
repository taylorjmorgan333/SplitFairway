"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { resetPasswordAction, type ActionState } from "@/actions/auth";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

const initialState: ActionState = { status: "idle" };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Updating…" : "Update password"}
    </Button>
  );
}

export function ResetPasswordForm() {
  const [state, formAction] = useActionState(resetPasswordAction, initialState);

  if (state.status === "success") {
    return <Alert variant="success">{state.message}</Alert>;
  }

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {state.status === "error" && state.message && (
        <Alert variant="error">{state.message}</Alert>
      )}

      <FormField
        id="password"
        label="New password"
        errors={state.fieldErrors?.password}
        hint="At least 8 characters."
      >
        <Input name="password" type="password" autoComplete="new-password" required />
      </FormField>

      <FormField
        id="confirmPassword"
        label="Confirm new password"
        errors={state.fieldErrors?.confirmPassword}
      >
        <Input name="confirmPassword" type="password" autoComplete="new-password" required />
      </FormField>

      <SubmitButton />
    </form>
  );
}
