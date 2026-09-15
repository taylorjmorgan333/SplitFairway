"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { convertGuestAccountAction } from "@/actions/guest-account";
import type { ActionState } from "@/actions/auth";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";

const initialState: ActionState = { status: "idle" };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending} className="w-full">
      {pending ? "Creating…" : "Create my account"}
    </Button>
  );
}

/**
 * "Clearly offer 'Create an account to save your history' after the
 * round without requiring it beforehand" (spec item 1) -- shown while
 * a guest is signed in anonymously, collapsed by default so it never
 * blocks or slows down scoring. Expanding it doesn't start a new
 * flow: convertGuestAccountAction upgrades this exact session in
 * place, so every score already entered stays attached.
 */
export function GuestAccountUpsell() {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(convertGuestAccountAction, initialState);

  if (state.status === "success") {
    return (
      <Card className="mb-4 border-emerald-200 bg-emerald-50">
        <CardContent className="p-3.5 text-sm text-emerald-800">{state.message}</CardContent>
      </Card>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mb-4 w-full rounded-lg border border-forest-700/20 bg-forest-50 px-3.5 py-2.5 text-left text-sm font-medium text-forest-800 hover:bg-forest-100"
      >
        Create an account to save your history →
      </button>
    );
  }

  return (
    <Card className="mb-4">
      <CardContent className="space-y-3 p-3.5">
        <p className="text-sm font-medium text-forest-900">Save your history</p>
        <p className="text-xs text-charcoal-500">
          Your scores are already saved -- this just lets you log back in later and see them.
        </p>
        {state.status === "error" && state.message && <Alert variant="error">{state.message}</Alert>}
        <form action={formAction} className="space-y-3">
          <FormField id="fullName" label="Name" errors={state.fieldErrors?.fullName}>
            <Input name="fullName" autoComplete="name" required />
          </FormField>
          <FormField id="email" label="Email" errors={state.fieldErrors?.email}>
            <Input name="email" type="email" autoComplete="email" required />
          </FormField>
          <FormField id="password" label="Password" errors={state.fieldErrors?.password}>
            <Input name="password" type="password" autoComplete="new-password" required />
          </FormField>
          <FormField id="confirmPassword" label="Confirm password" errors={state.fieldErrors?.confirmPassword}>
            <Input name="confirmPassword" type="password" autoComplete="new-password" required />
          </FormField>
          <SubmitButton />
        </form>
      </CardContent>
    </Card>
  );
}
