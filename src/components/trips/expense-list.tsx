"use client";

import { useState, useTransition } from "react";
import { deleteExpenseAction } from "@/actions/expenses";
import { ExpenseForm } from "@/components/trips/expense-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Tables } from "@/lib/supabase/database.types";

export type ExpenseRow = Tables<"expenses"> & {
  shares: { trip_member_id: string; amount_owed_cents: number; display_name: string }[];
  paidByName: string | null;
};

type Member = { id: string; display_name: string };

const CATEGORY_LABELS: Record<Tables<"expenses">["category"], string> = {
  lodging: "Lodging",
  golf: "Golf",
  transportation: "Transportation",
  food: "Food & drink",
  merchandise: "Merchandise",
  activity: "Activity",
  other: "Other",
};

export function ExpenseList({
  tripId,
  expenses,
  isCaptain,
  members,
}: {
  tripId: string;
  expenses: ExpenseRow[];
  isCaptain: boolean;
  /** Active members, offered as split candidates when editing. */
  members: Member[];
}) {
  if (expenses.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-forest-900/15 bg-cream-100 px-4 py-6 text-center">
        <p className="text-sm text-charcoal-500">No expenses added yet.</p>
        <p className="mx-auto mt-1.5 max-w-sm text-xs text-charcoal-400">
          For example: &ldquo;Lodging deposit — $1,200&rdquo; split evenly across everyone, or
          &ldquo;Tee times&rdquo; split only across the golfers who played. Add one from the form
          below.
        </p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-forest-900/[0.06]">
      {expenses.map((expense) => (
        <ExpenseRowItem
          key={expense.id}
          tripId={tripId}
          expense={expense}
          isCaptain={isCaptain}
          members={members}
        />
      ))}
    </ul>
  );
}

function ExpenseRowItem({
  tripId,
  expense,
  isCaptain,
  members,
}: {
  tripId: string;
  expense: ExpenseRow;
  isCaptain: boolean;
  members: Member[];
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDelete() {
    if (!window.confirm(`Delete "${expense.title}"? This removes it for everyone on the trip.`)) {
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await deleteExpenseAction(tripId, expense.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not delete the expense.");
      }
    });
  }

  const missingMemberIds = expense.shares
    .map((s) => s.trip_member_id)
    .filter((id) => !members.some((m) => m.id === id));

  return (
    <li className="py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-left text-sm font-medium text-charcoal hover:text-forest-800"
          >
            {expense.title}
          </button>
          <p className="mt-0.5 text-xs text-charcoal-400">
            <Badge variant="neutral" className="mr-1.5">
              {CATEGORY_LABELS[expense.category]}
            </Badge>
            {expense.paidByName ? `Paid by ${expense.paidByName}` : "Payer not set"}
            {expense.expense_date ? ` · ${formatDate(expense.expense_date)}` : ""}
            {expense.due_date ? ` · Due ${formatDate(expense.due_date)}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-charcoal">
            {formatCurrency(expense.total_amount_cents)}
          </span>
          {isCaptain && (
            <>
              <Button
                variant="ghost"
                size="sm"
                disabled={isPending}
                onClick={() => {
                  setEditing((v) => !v);
                  setExpanded(true);
                }}
              >
                {editing ? "Close" : "Edit"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={isPending}
                onClick={handleDelete}
                className="text-red-700 hover:bg-red-50"
              >
                Delete
              </Button>
            </>
          )}
        </div>
      </div>

      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}

      {expanded && !editing && (
        <div className="mt-3 space-y-1 rounded-lg bg-cream-100 p-3">
          {expense.notes && <p className="mb-2 text-xs text-charcoal-600">{expense.notes}</p>}
          {expense.shares.map((share) => (
            <div key={share.trip_member_id} className="flex justify-between text-xs text-charcoal-600">
              <span>{share.display_name}</span>
              <span>{formatCurrency(share.amount_owed_cents)}</span>
            </div>
          ))}
        </div>
      )}

      {expanded && editing && (
        <div className="mt-3 rounded-lg border border-forest-900/[0.08] bg-cream-100 p-4">
          {missingMemberIds.length > 0 && (
            <p className="mb-3 text-xs text-gold-700">
              One or more golfers in this expense&apos;s current split are no longer active on the
              trip — saving will re-split the total across the golfers selected below.
            </p>
          )}
          <ExpenseForm
            tripId={tripId}
            members={members}
            expense={{
              id: expense.id,
              title: expense.title,
              category: expense.category,
              totalAmountCents: expense.total_amount_cents,
              vendor: expense.vendor,
              expenseDate: expense.expense_date,
              dueDate: expense.due_date,
              notes: expense.notes,
              paidByMemberId: expense.paid_by_member_id,
              splitMethod: expense.split_method,
              shares: expense.shares
                .filter((s) => members.some((m) => m.id === s.trip_member_id))
                .map((s) => ({ tripMemberId: s.trip_member_id, amountOwedCents: s.amount_owed_cents })),
            }}
            onDone={() => setEditing(false)}
          />
        </div>
      )}
    </li>
  );
}
