"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { forgotPasswordAction, type ActionState } from "@/actions/auth";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

const initialState: ActionState = { status: "idle" };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Sending…" : "Send reset link"}
    </Button>
  );
}

export function ForgotPasswordForm() {
  const [state, formAction] = useActionState(forgotPasswordAction, initialState);

  if (state.status === "success") {
    return <Alert variant="success">{state.message}</Alert>;
  }

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {state.status === "error" && state.message && (
        <Alert variant="error">{state.message}</Alert>
      )}

      <FormField id="email" label="Email" errors={state.fieldErrors?.email}>
        <Input name="email" type="email" autoComplete="email" required />
      </FormField>

      <SubmitButton />

      <p className="text-center text-sm text-charcoal-500">
        <Link href="/login" className="font-medium text-forest-800 hover:underline">
          Back to log in
        </Link>
      </p>
    </form>
  );
}
