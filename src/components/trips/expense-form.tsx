"use client";

import { useEffect, useMemo, useState } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { createExpenseAction, updateExpenseAction } from "@/actions/expenses";
import type { ActionState } from "@/actions/auth";
import { EXPENSE_CATEGORY_VALUES } from "@/lib/validation/expense";
import { centsToDollarInput } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormField } from "@/components/ui/form-field";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import type { Tables } from "@/lib/supabase/database.types";

const initialState: ActionState = { status: "idle" };

const CATEGORY_LABELS: Record<(typeof EXPENSE_CATEGORY_VALUES)[number], string> = {
  lodging: "Lodging",
  golf: "Golf",
  transportation: "Transportation",
  food: "Food & drink",
  merchandise: "Merchandise",
  activity: "Activity",
  other: "Other",
};

type Member = { id: string; display_name: string };

export type ExpenseFormExisting = {
  id: string;
  title: string;
  category: Tables<"expenses">["category"];
  totalAmountCents: number;
  vendor: string | null;
  expenseDate: string | null;
  dueDate: string | null;
  notes: string | null;
  paidByMemberId: string | null;
  splitMethod: Tables<"expenses">["split_method"];
  shares: { tripMemberId: string; amountOwedCents: number }[];
};

function SubmitButton({ isEditing }: { isEditing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : isEditing ? "Save changes" : "Add expense"}
    </Button>
  );
}

export function ExpenseForm({
  tripId,
  members,
  expense,
  onDone,
}: {
  tripId: string;
  members: Member[];
  /** When provided, the form edits this expense instead of creating a new one. */
  expense?: ExpenseFormExisting;
  /** Called after a successful save — useful for closing an edit panel. */
  onDone?: () => void;
}) {
  const isEditing = Boolean(expense);
  const boundAction = expense
    ? updateExpenseAction.bind(null, tripId, expense.id)
    : createExpenseAction.bind(null, tripId);
  const [state, formAction] = useActionState(boundAction, initialState);
  const [splitMode, setSplitMode] = useState<"equal" | "custom">(
    expense?.splitMethod === "custom" ? "custom" : "equal",
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(expense ? expense.shares.map((s) => s.tripMemberId) : members.map((m) => m.id)),
  );

  const customAmountByMember = useMemo(() => {
    const map = new Map<string, string>();
    if (expense) {
      for (const share of expense.shares) {
        map.set(share.tripMemberId, centsToDollarInput(share.amountOwedCents));
      }
    }
    return map;
  }, [expense]);

  const selectedMembers = useMemo(
    () => members.filter((m) => selectedIds.has(m.id)),
    [members, selectedIds],
  );

  function toggleMember(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  useEffect(() => {
    if (state.status === "success" && onDone) {
      onDone();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {state.status === "error" && state.message && (
        <Alert variant="error">{state.message}</Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="title" label="What was it for?" errors={state.fieldErrors?.title}>
          <Input name="title" type="text" placeholder="e.g. Lodging deposit" defaultValue={expense?.title} required />
        </FormField>
        <FormField id="totalAmount" label="Total amount" errors={state.fieldErrors?.totalAmount}>
          <Input
            name="totalAmount"
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            defaultValue={expense ? centsToDollarInput(expense.totalAmountCents) : undefined}
            required
          />
        </FormField>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="category">Category</Label>
          <select
            id="category"
            name="category"
            defaultValue={expense?.category ?? "other"}
            className="h-11 w-full rounded-lg border border-charcoal-400/25 bg-white px-3.5 text-sm text-charcoal transition-colors focus:border-forest-600"
          >
            {EXPENSE_CATEGORY_VALUES.map((value) => (
              <option key={value} value={value}>
                {CATEGORY_LABELS[value]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="paidByMemberId">Who initially paid?</Label>
          <select
            id="paidByMemberId"
            name="paidByMemberId"
            defaultValue={expense?.paidByMemberId ?? ""}
            className="h-11 w-full rounded-lg border border-charcoal-400/25 bg-white px-3.5 text-sm text-charcoal transition-colors focus:border-forest-600"
          >
            <option value="">Not sure yet</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.display_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <FormField id="vendor" label="Vendor" errors={state.fieldErrors?.vendor} hint="Optional">
          <Input name="vendor" type="text" placeholder="e.g. Marriott" defaultValue={expense?.vendor ?? undefined} />
        </FormField>
        <FormField id="expenseDate" label="Date" errors={state.fieldErrors?.expenseDate}>
          <Input name="expenseDate" type="date" defaultValue={expense?.expenseDate ?? undefined} />
        </FormField>
        <FormField id="dueDate" label="Due date" errors={state.fieldErrors?.dueDate} hint="Optional">
          <Input name="dueDate" type="date" defaultValue={expense?.dueDate ?? undefined} />
        </FormField>
      </div>

      <FormField id="notes" label="Notes" errors={state.fieldErrors?.notes} hint="Optional">
        <textarea
          name="notes"
          rows={2}
          defaultValue={expense?.notes ?? undefined}
          className="w-full rounded-lg border border-charcoal-400/25 bg-white px-3.5 py-2.5 text-sm text-charcoal placeholder:text-charcoal-400 transition-colors focus:border-forest-600"
        />
      </FormField>

      <div>
        <Label>Split with</Label>
        <div className="flex flex-wrap gap-2">
          {members.map((m) => (
            <label
              key={m.id}
              className="flex min-h-11 items-center gap-2 rounded-full border border-forest-900/[0.08] bg-cream-100 px-3.5 py-2 text-sm text-charcoal sm:min-h-0 sm:py-1.5"
            >
              <input
                type="checkbox"
                name="memberIds"
                value={m.id}
                checked={selectedIds.has(m.id)}
                onChange={() => toggleMember(m.id)}
                className="h-4 w-4"
              />
              {m.display_name}
            </label>
          ))}
        </div>
      </div>

      <div>
        <Label>How to split it</Label>
        <div className="flex gap-4 text-sm text-charcoal">
          <label className="flex min-h-11 items-center gap-2 sm:min-h-0">
            <input
              type="radio"
              name="splitMode"
              value="equal"
              checked={splitMode === "equal"}
              onChange={() => setSplitMode("equal")}
              className="h-4 w-4"
            />
            Split evenly
          </label>
          <label className="flex min-h-11 items-center gap-2 sm:min-h-0">
            <input
              type="radio"
              name="splitMode"
              value="custom"
              checked={splitMode === "custom"}
              onChange={() => setSplitMode("custom")}
              className="h-4 w-4"
            />
            Custom amounts
          </label>
        </div>
        <p className="mt-1 text-xs text-charcoal-400">
          {selectedMembers.length === members.length
            ? "Splitting evenly divides the total across every selected golfer, distributing any odd cent deterministically."
            : "Splitting evenly here divides the total across only the golfers checked above."}
        </p>
      </div>

      {splitMode === "custom" && (
        <div className="space-y-2 rounded-lg border border-forest-900/[0.08] bg-cream-100 p-4">
          {selectedMembers.length === 0 ? (
            <p className="text-sm text-charcoal-500">Select at least one golfer above.</p>
          ) : (
            selectedMembers.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-3">
                <label htmlFor={`amount_${m.id}`} className="text-sm text-charcoal">
                  {m.display_name}
                </label>
                <Input
                  id={`amount_${m.id}`}
                  name={`amount_${m.id}`}
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  defaultValue={customAmountByMember.get(m.id)}
                  className="w-28"
                />
              </div>
            ))
          )}
          <p className="text-xs text-charcoal-500">
            Custom amounts must add up to exactly the total — the server double-checks this and
            rejects the save otherwise.
          </p>
        </div>
      )}

      <div className="flex items-center gap-3">
        <SubmitButton isEditing={isEditing} />
        {isEditing && onDone && (
          <Button type="button" variant="ghost" size="sm" onClick={onDone}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
