"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { reportPaymentSchema } from "@/lib/validation/payment";
import { parseDollarsToCents } from "@/lib/utils";
import { trackEvent } from "@/lib/analytics";
import type { ActionState } from "@/actions/auth";

export async function reportPaymentAction(
  tripId: string,
  payerMemberId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = reportPaymentSchema.safeParse({
    amount: formData.get("amount"),
    paymentMethod: formData.get("paymentMethod"),
    recipientMemberId: formData.get("recipientMemberId"),
    paidAt: formData.get("paidAt"),
    referenceNote: formData.get("referenceNote"),
  });

  if (!parsed.success) {
    return { status: "error", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const amountCents = parseDollarsToCents(parsed.data.amount);
  if (amountCents === null || amountCents <= 0) {
    return {
      status: "error",
      fieldErrors: { amount: ["Enter a dollar amount greater than zero"] },
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { status: "error", message: "You need to be signed in to report a payment." };
  }

  // RLS (payments_insert_own_report) enforces that a golfer can only
  // report a payment as themselves, and only in "reported" status —
  // they can't insert a pre-confirmed payment.
  const { data: payment, error } = await supabase
    .from("payments")
    .insert({
      trip_id: tripId,
      payer_member_id: payerMemberId,
      recipient_member_id: parsed.data.recipientMemberId || null,
      amount_cents: amountCents,
      payment_method: parsed.data.paymentMethod,
      reference_note: parsed.data.referenceNote || null,
      paid_at: parsed.data.paidAt ? new Date(parsed.data.paidAt).toISOString() : new Date().toISOString(),
      reported_by: user.id,
      status: "reported",
    })
    .select("id")
    .single();

  if (error) {
    return { status: "error", message: error.message };
  }

  await supabase.from("activity_log").insert({
    trip_id: tripId,
    actor_user_id: user.id,
    event_type: "payment_reported",
    event_data: { payment_id: payment.id, amount_cents: amountCents },
  });
  await trackEvent(supabase, user.id, "payment_reported", { method: parsed.data.paymentMethod }, tripId);

  revalidatePath(`/trips/${tripId}`);
  return { status: "success", message: "Payment reported — the trip's captain will confirm it." };
}

export async function confirmPaymentAction(tripId: string, paymentId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("confirm_payment", { p_payment_id: paymentId });

  if (error) {
    throw new Error(error.message);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    await trackEvent(supabase, user.id, "payment_confirmed", {}, tripId);
  }

  revalidatePath(`/trips/${tripId}`);
}

export async function rejectPaymentAction(tripId: string, paymentId: string, reason?: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("reject_payment", {
    p_payment_id: paymentId,
    p_reason: reason || undefined,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/trips/${tripId}`);
}
