"use client";

import { useState } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { signUpAction, type ActionState } from "@/actions/auth";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { Label } from "@/components/ui/label";
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

function PasswordField({ errors }: { errors?: string[] }) {
  const [visible, setVisible] = useState(false);
  const describedBy = errors?.length ? "password-error" : "password-hint";

  return (
    <div>
      <Label htmlFor="password">Password</Label>
      <div className="flex gap-2">
        <Input
          id="password"
          name="password"
          type={visible ? "text" : "password"}
          autoComplete="new-password"
          required
          minLength={8}
          aria-invalid={Boolean(errors?.length)}
          aria-describedby={describedBy}
          className="flex-1"
        />
        <button
          type="button"
          className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-lg border border-charcoal-400/25 px-3 text-sm font-medium text-forest-900 hover:bg-cream-100"
          aria-pressed={visible}
          aria-label={visible ? "Hide password" : "Show password"}
          onClick={() => setVisible((current) => !current)}
        >
          {visible ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
          {visible ? "Hide" : "Show"}
        </button>
      </div>
      {errors?.length ? (
        <p id="password-error" role="alert" className="mt-1.5 text-xs text-red-600">
          {errors[0]}
        </p>
      ) : (
        <p id="password-hint" className="mt-1.5 text-xs text-charcoal-400">
          At least 8 characters.
        </p>
      )}
    </div>
  );
}

/**
 * Email and password only. This repo never calls `signInWithOAuth` and
 * has no Google or Apple provider wiring, so social buttons are not
 * shown here. Adding them means enabling those providers in the
 * Supabase project and sending the redirect through `/auth/callback`
 * before any button is rendered.
 */
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

      <PasswordField errors={state.fieldErrors?.password} />

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
