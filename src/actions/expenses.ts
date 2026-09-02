"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { expenseBaseSchema } from "@/lib/validation/expense";
import { parseDollarsToCents } from "@/lib/utils";
import { splitEqually, validateCustomSplit, equalSplitMethod, type ExpenseShareCalc } from "@/lib/split";
import { trackEvent } from "@/lib/analytics";
import type { ActionState } from "@/actions/auth";

/**
 * Read the split fields (memberIds, splitMode, custom per-member
 * amounts) off submitted form data and turn them into validated
 * expense_shares — the ONE place this happens, shared by create and
 * update. All math runs through src/lib/split.ts; nothing here trusts
 * a total the browser might have computed itself.
 */
async function resolveShares(
  tripId: string,
  totalCents: number,
  splitMode: "equal" | "custom",
  formData: FormData,
): Promise<{ shares: ExpenseShareCalc[]; splitMethod: "equal" | "selected" | "custom" } | { error: string }> {
  const memberIds = formData.getAll("memberIds").map(String).filter(Boolean);
  if (memberIds.length === 0) {
    return { error: "Select at least one golfer to split this with." };
  }

  if (splitMode === "custom") {
    const shares: ExpenseShareCalc[] = memberIds.map((id) => ({
      tripMemberId: id,
      amountOwedCents: parseDollarsToCents(formData.get(`amount_${id}`)) ?? -1,
    }));
    const result = validateCustomSplit(totalCents, shares);
    if (!result.valid) {
      return { error: result.error };
    }
    return { shares, splitMethod: "custom" };
  }

  const supabase = await createClient();
  const { count: activeMemberCount } = await supabase
    .from("trip_members")
    .select("id", { count: "exact", head: true })
    .eq("trip_id", tripId)
    .eq("status", "active");

  const shares = splitEqually(totalCents, memberIds);
  return { shares, splitMethod: equalSplitMethod(memberIds, activeMemberCount ?? memberIds.length) };
}

export async function createExpenseAction(
  tripId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = expenseBaseSchema.safeParse({
    title: formData.get("title"),
    category: formData.get("category") || "other",
    totalAmount: formData.get("totalAmount"),
    vendor: formData.get("vendor"),
    expenseDate: formData.get("expenseDate"),
    dueDate: formData.get("dueDate"),
    notes: formData.get("notes"),
    paidByMemberId: formData.get("paidByMemberId"),
    splitMode: formData.get("splitMode") || "equal",
  });

  if (!parsed.success) {
    return { status: "error", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const totalCents = parseDollarsToCents(parsed.data.totalAmount);
  if (totalCents === null || totalCents <= 0) {
    return {
      status: "error",
      fieldErrors: { totalAmount: ["Enter a dollar amount greater than zero"] },
    };
  }

  const resolved = await resolveShares(tripId, totalCents, parsed.data.splitMode, formData);
  if ("error" in resolved) {
    return { status: "error", message: resolved.error };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_expense_with_shares", {
    p_trip_id: tripId,
    p_title: parsed.data.title,
    p_total_amount_cents: totalCents,
    p_shares: resolved.shares.map((s) => ({
      trip_member_id: s.tripMemberId,
      amount_owed_cents: s.amountOwedCents,
    })),
    p_category: parsed.data.category,
    p_split_method: resolved.splitMethod,
    p_paid_by_member_id: parsed.data.paidByMemberId || undefined,
    p_vendor: parsed.data.vendor || undefined,
    p_expense_date: parsed.data.expenseDate || undefined,
    p_due_date: parsed.data.dueDate || undefined,
    p_notes: parsed.data.notes || undefined,
  });

  if (error) {
    return { status: "error", message: error.message };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    await trackEvent(supabase, user.id, "expense_created", { category: parsed.data.category }, tripId);
  }

  revalidatePath(`/trips/${tripId}`);
  return { status: "success", message: "Expense added." };
}

export async function updateExpenseAction(
  tripId: string,
  expenseId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = expenseBaseSchema.safeParse({
    title: formData.get("title"),
    category: formData.get("category") || "other",
    totalAmount: formData.get("totalAmount"),
    vendor: formData.get("vendor"),
    expenseDate: formData.get("expenseDate"),
    dueDate: formData.get("dueDate"),
    notes: formData.get("notes"),
    paidByMemberId: formData.get("paidByMemberId"),
    splitMode: formData.get("splitMode") || "equal",
  });

  if (!parsed.success) {
    return { status: "error", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const totalCents = parseDollarsToCents(parsed.data.totalAmount);
  if (totalCents === null || totalCents <= 0) {
    return {
      status: "error",
      fieldErrors: { totalAmount: ["Enter a dollar amount greater than zero"] },
    };
  }

  const resolved = await resolveShares(tripId, totalCents, parsed.data.splitMode, formData);
  if ("error" in resolved) {
    return { status: "error", message: resolved.error };
  }

  const supabase = await createClient();
  // update_expense_with_shares() re-checks is_trip_captain() itself and
  // re-validates the share sum server-side — the form's own math above
  // is only ever a preview, never trusted on its own.
  const { error } = await supabase.rpc("update_expense_with_shares", {
    p_expense_id: expenseId,
    p_title: parsed.data.title,
    p_total_amount_cents: totalCents,
    p_shares: resolved.shares.map((s) => ({
      trip_member_id: s.tripMemberId,
      amount_owed_cents: s.amountOwedCents,
    })),
    p_category: parsed.data.category,
    p_split_method: resolved.splitMethod,
    p_paid_by_member_id: parsed.data.paidByMemberId || undefined,
    p_vendor: parsed.data.vendor || undefined,
    p_expense_date: parsed.data.expenseDate || undefined,
    p_due_date: parsed.data.dueDate || undefined,
    p_notes: parsed.data.notes || undefined,
  });

  if (error) {
    return { status: "error", message: error.message };
  }

  revalidatePath(`/trips/${tripId}`);
  return { status: "success", message: "Expense updated." };
}

export async function deleteExpenseAction(tripId: string, expenseId: string) {
  const supabase = await createClient();

  // Read the title first (for the activity log entry) — RLS still
  // enforces that only a member of this trip can see it.
  const { data: expense } = await supabase
    .from("expenses")
    .select("title")
    .eq("id", expenseId)
    .maybeSingle();

  // RLS (expenses_delete_captain) enforces captain-only here; a single
  // DELETE statement is itself an atomic transaction, and the
  // expense_shares foreign key is ON DELETE CASCADE, so the expense and
  // every one of its shares disappear together or not at all.
  const { error, count } = await supabase
    .from("expenses")
    .delete({ count: "exact" })
    .eq("id", expenseId);

  if (error) {
    throw new Error(error.message);
  }
  if (!count) {
    throw new Error("You don't have permission to delete this expense.");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    await supabase.from("activity_log").insert({
      trip_id: tripId,
      actor_user_id: user.id,
      event_type: "expense_deleted",
      event_data: { expense_id: expenseId, title: expense?.title ?? null },
    });
  }

  revalidatePath(`/trips/${tripId}`);
}
