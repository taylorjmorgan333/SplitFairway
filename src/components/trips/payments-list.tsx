"use client";

import { useState, useTransition } from "react";
import { confirmPaymentAction, rejectPaymentAction } from "@/actions/payments";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/utils";
import { PAYMENT_METHOD_LABELS } from "@/lib/validation/payment";
import type { Tables } from "@/lib/supabase/database.types";

export type PaymentRow = Tables<"payments"> & {
  payerName: string;
  recipientName: string | null;
};

const STATUS_BADGE: Record<Tables<"payments">["status"], "gold" | "success" | "neutral"> = {
  reported: "gold",
  confirmed: "success",
  rejected: "neutral",
};

export function PaymentsList({
  tripId,
  payments,
  isCaptain,
  currentUserMemberId,
}: {
  tripId: string;
  payments: PaymentRow[];
  isCaptain: boolean;
  currentUserMemberId?: string | null;
}) {
  if (payments.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-forest-900/15 bg-cream-100 px-4 py-6 text-center">
        <p className="text-sm text-charcoal-500">No payments reported yet.</p>
        <p className="mx-auto mt-1.5 max-w-sm text-xs text-charcoal-400">
          For example: once someone Venmos the trip captain $150 for their share, they&apos;d
          report it below — it shows as &ldquo;Awaiting confirmation&rdquo; until the captain (or
          that specific recipient) confirms it actually arrived.
        </p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-forest-900/[0.06]">
      {payments.map((payment) => (
        <PaymentRowItem
          key={payment.id}
          tripId={tripId}
          payment={payment}
          // The RPCs authorize either a captain or the payment's own
          // designated recipient (e.g. Chris can confirm a payment Mike
          // reported paying directly to Chris, even if Chris isn't a
          // co-treasurer) — mirror that here so the buttons only show
          // for someone who can actually use them.
          canDecide={
            isCaptain ||
            (currentUserMemberId != null && payment.recipient_member_id === currentUserMemberId)
          }
        />
      ))}
    </ul>
  );
}

function PaymentRowItem({
  tripId,
  payment,
  canDecide,
}: {
  tripId: string;
  payment: PaymentRow;
  canDecide: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      try {
        await confirmPaymentAction(tripId, payment.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not confirm the payment.");
      }
    });
  }

  function handleReject() {
    setError(null);
    startTransition(async () => {
      try {
        await rejectPaymentAction(tripId, payment.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not reject the payment.");
      }
    });
  }

  return (
    <li className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm text-charcoal">
          <span className="font-medium">{payment.payerName}</span> paid{" "}
          {formatCurrency(payment.amount_cents)} via {PAYMENT_METHOD_LABELS[payment.payment_method]}
          {payment.recipientName ? ` to ${payment.recipientName}` : ""}
        </p>
        <p className="text-xs text-charcoal-400">
          {formatDate(payment.paid_at)}
          {payment.reference_note ? ` · ${payment.reference_note}` : ""}
        </p>
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </div>
      <div className="flex items-center gap-2">
        <Badge variant={STATUS_BADGE[payment.status]} className="capitalize">
          {payment.status}
        </Badge>
        {canDecide && payment.status === "reported" && (
          <>
            <Button variant="outline" size="sm" disabled={isPending} onClick={handleConfirm}>
              Confirm
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={isPending}
              onClick={handleReject}
              className="text-red-700 hover:bg-red-50"
            >
              Reject
            </Button>
          </>
        )}
      </div>
    </li>
  );
}
