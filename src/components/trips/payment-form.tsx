"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { reportPaymentAction } from "@/actions/payments";
import type { ActionState } from "@/actions/auth";
import { PAYMENT_METHOD_VALUES, PAYMENT_METHOD_LABELS } from "@/lib/validation/payment";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormField } from "@/components/ui/form-field";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

const initialState: ActionState = { status: "idle" };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "Reporting…" : "Report payment"}
    </Button>
  );
}

export function PaymentForm({
  tripId,
  payerMemberId,
  recipients,
}: {
  tripId: string;
  payerMemberId: string;
  recipients: { id: string; display_name: string }[];
}) {
  const boundAction = reportPaymentAction.bind(null, tripId, payerMemberId);
  const [state, formAction] = useActionState(boundAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  // Clear the fields once a payment is successfully reported — without
  // this the amount/note/etc. sat there looking like they still needed
  // submitting even though the success alert above already confirmed it.
  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
    }
  }, [state.status]);

  return (
    <form ref={formRef} action={formAction} className="space-y-4" noValidate>
      {state.status === "error" && state.message && (
        <Alert variant="error">{state.message}</Alert>
      )}
      {state.status === "success" && state.message && (
        <Alert variant="success">{state.message}</Alert>
      )}
      <p className="rounded-lg bg-cream-100 px-3.5 py-3 text-xs text-charcoal-500">
        SplitFairway tracks payments but does not transfer funds. Complete the payment
        using the trip captain&apos;s instructions, then record it here.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="amount" label="Amount" errors={state.fieldErrors?.amount}>
          <Input name="amount" type="text" inputMode="decimal" placeholder="0.00" required />
        </FormField>
        <div>
          <Label htmlFor="paymentMethod">How did you pay?</Label>
          <select
            id="paymentMethod"
            name="paymentMethod"
            defaultValue="venmo"
            className="h-11 w-full rounded-lg border border-charcoal-400/25 bg-white px-3.5 text-sm text-charcoal transition-colors focus:border-forest-600"
          >
            {PAYMENT_METHOD_VALUES.map((value) => (
              <option key={value} value={value}>
                {PAYMENT_METHOD_LABELS[value]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          id="recipientMemberId"
          label="Who did you pay?"
          errors={state.fieldErrors?.recipientMemberId}
        >
          <select
            id="recipientMemberId"
            name="recipientMemberId"
            defaultValue=""
            required
            className="h-11 w-full rounded-lg border border-charcoal-400/25 bg-white px-3.5 text-sm text-charcoal transition-colors focus:border-forest-600"
          >
            <option value="" disabled>
              Select a golfer
            </option>
            {recipients.map((r) => (
              <option key={r.id} value={r.id}>
                {r.display_name}
              </option>
            ))}
          </select>
        </FormField>
        <FormField id="paidAt" label="Date" errors={state.fieldErrors?.paidAt}>
          <Input name="paidAt" type="date" />
        </FormField>
      </div>

      <FormField
        id="referenceNote"
        label="Note"
        errors={state.fieldErrors?.referenceNote}
        hint="Optional — e.g. a Venmo confirmation number"
      >
        <Input name="referenceNote" type="text" placeholder="Optional" />
      </FormField>

      <SubmitButton />
    </form>
  );
}
