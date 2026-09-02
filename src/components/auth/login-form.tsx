"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { loginAction, type ActionState } from "@/actions/auth";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

const initialState: ActionState = { status: "idle" };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Logging in…" : "Log in"}
    </Button>
  );
}

export function LoginForm() {
  const [state, formAction] = useActionState(loginAction, initialState);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {state.status === "error" && state.message && (
        <Alert variant="error">{state.message}</Alert>
      )}

      <FormField id="email" label="Email" errors={state.fieldErrors?.email}>
        <Input name="email" type="email" autoComplete="email" required />
      </FormField>

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <label htmlFor="password" className="block text-sm font-medium text-forest-900">
            Password
          </label>
          <Link
            href="/forgot-password"
            className="text-xs font-medium text-forest-700 hover:underline"
          >
            Forgot password?
          </Link>
        </div>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={Boolean(state.fieldErrors?.password)}
        />
        {state.fieldErrors?.password && (
          <p role="alert" className="mt-1.5 text-xs text-red-600">
            {state.fieldErrors.password[0]}
          </p>
        )}
      </div>

      <SubmitButton />

      <p className="text-center text-sm text-charcoal-500">
        New here?{" "}
        <Link href="/signup" className="font-medium text-forest-800 hover:underline">
          Create an account
        </Link>
      </p>
    </form>
  );
}
