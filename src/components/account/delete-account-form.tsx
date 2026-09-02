"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { deleteAccountAction } from "@/actions/account";
import type { ActionState } from "@/actions/auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormField } from "@/components/ui/form-field";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

const initialState: ActionState = { status: "idle" };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="bg-red-700 hover:bg-red-800">
      {pending ? "Deleting…" : "Permanently delete my account"}
    </Button>
  );
}

/**
 * The real, self-serve replacement for "email support to delete your
 * account." Two deliberate-action requirements before anything happens:
 * the account's current password (re-authentication) and typing the
 * literal word DELETE — see src/actions/account.ts and
 * supabase/migrations/20260902070000_account_deletion.sql for exactly
 * what gets deleted vs. anonymized.
 */
export function DeleteAccountForm() {
  const [expanded, setExpanded] = useState(false);
  const [state, formAction] = useActionState(deleteAccountAction, initialState);

  if (!expanded) {
    return (
      <Button
        type="button"
        variant="outline"
        onClick={() => setExpanded(true)}
        className="border-red-200 text-red-700 hover:bg-red-50"
      >
        Delete my account
      </Button>
    );
  }

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <Alert variant="error">
        <strong>This can&apos;t be undone.</strong> Your profile and login are deleted
        immediately. Trips only you use are deleted entirely. On trips you share with other
        golfers, your name and email are removed but your expense and payment history stays so
        their balances stay correct — see the{" "}
        <a href="/legal/data-deletion" className="underline">
          data deletion page
        </a>{" "}
        for the full policy.
      </Alert>

      {state.status === "error" && state.message && <Alert variant="error">{state.message}</Alert>}

      <FormField
        id="password"
        label="Confirm your password"
        errors={state.fieldErrors?.password}
      >
        <Input name="password" type="password" autoComplete="current-password" required />
      </FormField>

      <div>
        <Label htmlFor="confirmation">
          Type <span className="font-mono font-semibold">DELETE</span> to confirm
        </Label>
        <Input name="confirmation" id="confirmation" type="text" autoComplete="off" required />
        {state.fieldErrors?.confirmation && (
          <p className="mt-1 text-xs text-red-600">{state.fieldErrors.confirmation[0]}</p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <SubmitButton />
        <Button type="button" variant="ghost" onClick={() => setExpanded(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
