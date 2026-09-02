"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { signUpAction, type ActionState } from "@/actions/auth";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

const initialState: ActionState = { status: "idle" };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Creating account…" : "Create account"}
    </Button>
  );
}

export function SignupForm({ next }: { next?: string }) {
  const [state, formAction] = useActionState(signUpAction, initialState);

  if (state.status === "success") {
    return (
      <Alert variant="success">
        {state.message}
      </Alert>
    );
  }

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {next && <input type="hidden" name="next" value={next} />}
      {state.status === "error" && state.message && (
        <Alert variant="error">{state.message}</Alert>
      )}

      <FormField id="fullName" label="Full name" errors={state.fieldErrors?.fullName}>
        <Input name="fullName" type="text" autoComplete="name" required />
      </FormField>

      <FormField id="email" label="Email" errors={state.fieldErrors?.email}>
        <Input name="email" type="email" autoComplete="email" required />
      </FormField>

      <FormField
        id="password"
        label="Password"
        errors={state.fieldErrors?.password}
        hint="At least 8 characters."
      >
        <Input name="password" type="password" autoComplete="new-password" required />
      </FormField>

      <FormField
        id="confirmPassword"
        label="Confirm password"
        errors={state.fieldErrors?.confirmPassword}
      >
        <Input name="confirmPassword" type="password" autoComplete="new-password" required />
      </FormField>

      <SubmitButton />

      <p className="text-center text-sm text-charcoal-500">
        Already have an account?{" "}
        <Link
          href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"}
          className="font-medium text-forest-800 hover:underline"
        >
          Log in
        </Link>
      </p>
    </form>
  );
}
