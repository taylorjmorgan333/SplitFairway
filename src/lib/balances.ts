/**
 * The one authoritative balance-calculation module. Every screen that
 * shows what a golfer owes, has paid, or is owed back — the trip
 * Overview, the Golfers tab, the "Who owes what?" settlement view, the
 * cross-trip dashboard — computes it by calling calculateBalances()
 * here, so the math is never duplicated (and never drifts) across
 * components.
 *
 * Pure functions only: no DB access, no React. Callers fetch the raw
 * rows and pass them in as plain data, which is what makes this
 * unit-testable without a database.
 *
 * All amounts are integer cents. Never floating point.
 */

export type MemberInput = {
  id: string;
  displayName: string;
};

export type ExpenseShareInput = {
  tripMemberId: string;
  amountOwedCents: number;
};

export type ExpenseInput = {
  id: string;
  totalAmountCents: number;
  paidByMemberId: string | null;
  /** ISO date string (YYYY-MM-DD), or null if no due date was set. */
  dueDate: string | null;
  shares: ExpenseShareInput[];
};

export type PaymentInput = {
  id: string;
  payerMemberId: string;
  recipientMemberId: string | null;
  amountCents: number;
  status: "reported" | "confirmed" | "rejected";
};

export type MemberBalance = {
  memberId: string;
  displayName: string;
  /** Sum of this member's expense_shares across every expense on the trip. */
  totalShareCents: number;
  /** Sum of expenses this member personally fronted (paid_by_member_id = them). */
  paidTowardExpensesCents: number;
  /** Sum of this member's CONFIRMED outgoing reimbursements. */
  reimbursementsSentCents: number;
  /** Sum of this member's CONFIRMED incoming reimbursements. */
  reimbursementsReceivedCents: number;
  /** How much this member still needs to pay someone else, right now. */
  amountOwedCents: number;
  /** How much this member is still owed back, right now. */
  amountDueBackCents: number;
  /** Sum of this member's shares belonging to expenses with a due date today or later. */
  upcomingDueCents: number;
  /**
   * Net position: positive means the group owes this member money
   * (they're due money back), negative means this member owes the
   * group. Zero means fully settled. This is what settlement
   * suggestions are computed from.
   */
  netCents: number;
};

/**
 * Compute every member's balance from raw expense/share/payment rows.
 *
 * The formula, in plain terms, for each member:
 *   1. totalShareCents = what they're on the hook for (sum of their
 *      expense_shares).
 *   2. paidTowardExpensesCents = what they already fronted out of
 *      pocket (sum of expenses they're recorded as having paid).
 *   3. reimbursementsSentCents / reimbursementsReceivedCents = money
 *      that has changed hands afterward to settle up — but ONLY
 *      confirmed payments count. A merely "reported" payment hasn't
 *      been verified by a captain yet, so it can't move a balance.
 *   4. netCents = (paidTowardExpensesCents - totalShareCents)
 *                 + reimbursementsSentCents - reimbursementsReceivedCents
 *      Fronting more than your share, or sending a confirmed
 *      reimbursement, both push your net position up (you're owed
 *      more / owe less). Receiving a confirmed reimbursement pushes it
 *      back down.
 *   5. amountOwedCents = max(0, -netCents) — what's left for them to pay.
 *      amountDueBackCents = max(0, netCents) — what's left for them to collect.
 *   6. upcomingDueCents = the slice of their totalShareCents that
 *      belongs to expenses whose due date hasn't passed yet (today or
 *      later) — a heads-up on what's coming, independent of whether
 *      it's already been settled.
 */
export function calculateBalances(
  members: MemberInput[],
  expenses: ExpenseInput[],
  payments: PaymentInput[],
  today: Date = new Date(),
): MemberBalance[] {
  const todayStr = toDateOnlyString(today);

  const totalShareByMember = new Map<string, number>();
  const upcomingDueByMember = new Map<string, number>();
  for (const expense of expenses) {
    const isUpcoming = expense.dueDate !== null && expense.dueDate >= todayStr;
    for (const share of expense.shares) {
      totalShareByMember.set(
        share.tripMemberId,
        (totalShareByMember.get(share.tripMemberId) ?? 0) + share.amountOwedCents,
      );
      if (isUpcoming) {
        upcomingDueByMember.set(
          share.tripMemberId,
          (upcomingDueByMember.get(share.tripMemberId) ?? 0) + share.amountOwedCents,
        );
      }
    }
  }

  const paidByMember = new Map<string, number>();
  for (const expense of expenses) {
    if (!expense.paidByMemberId) continue;
    paidByMember.set(
      expense.paidByMemberId,
      (paidByMember.get(expense.paidByMemberId) ?? 0) + expense.totalAmountCents,
    );
  }

  const sentByMember = new Map<string, number>();
  const receivedByMember = new Map<string, number>();
  for (const payment of payments) {
    if (payment.status !== "confirmed") continue;
    sentByMember.set(
      payment.payerMemberId,
      (sentByMember.get(payment.payerMemberId) ?? 0) + payment.amountCents,
    );
    if (payment.recipientMemberId) {
      receivedByMember.set(
        payment.recipientMemberId,
        (receivedByMember.get(payment.recipientMemberId) ?? 0) + payment.amountCents,
      );
    }
  }

  return members.map((member) => {
    const totalShareCents = totalShareByMember.get(member.id) ?? 0;
    const paidTowardExpensesCents = paidByMember.get(member.id) ?? 0;
    const reimbursementsSentCents = sentByMember.get(member.id) ?? 0;
    const reimbursementsReceivedCents = receivedByMember.get(member.id) ?? 0;
    const upcomingDueCents = upcomingDueByMember.get(member.id) ?? 0;

    const netCents =
      paidTowardExpensesCents -
      totalShareCents +
      reimbursementsSentCents -
      reimbursementsReceivedCents;

    return {
      memberId: member.id,
      displayName: member.displayName,
      totalShareCents,
      paidTowardExpensesCents,
      reimbursementsSentCents,
      reimbursementsReceivedCents,
      amountOwedCents: Math.max(0, -netCents),
      amountDueBackCents: Math.max(0, netCents),
      upcomingDueCents,
      netCents,
    };
  });
}

export type SettlementSuggestion = {
  fromMemberId: string;
  fromName: string;
  toMemberId: string;
  toName: string;
  amountCents: number;
};

/**
 * Suggest the minimum set of reimbursements needed to settle every
 * CONFIRMED balance (does not create any payment transactions — this
 * is display-only). Standard greedy "simplify debts" approach: repeatedly
 * match whoever owes the most against whoever is owed the most, settle
 * the smaller of the two amounts between them, and repeat until
 * everyone nets to zero. This always produces at most (members - 1)
 * suggested transfers, regardless of how many individual expenses or
 * payments led to those balances.
 */
export function suggestSettlements(balances: MemberBalance[]): SettlementSuggestion[] {
  const creditors = balances
    .filter((b) => b.netCents > 0)
    .map((b) => ({ id: b.memberId, name: b.displayName, remaining: b.netCents }))
    .sort((a, b) => b.remaining - a.remaining);

  const debtors = balances
    .filter((b) => b.netCents < 0)
    .map((b) => ({ id: b.memberId, name: b.displayName, remaining: -b.netCents }))
    .sort((a, b) => b.remaining - a.remaining);

  const suggestions: SettlementSuggestion[] = [];
  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];
    const amount = Math.min(debtor.remaining, creditor.remaining);

    if (amount > 0) {
      suggestions.push({
        fromMemberId: debtor.id,
        fromName: debtor.name,
        toMemberId: creditor.id,
        toName: creditor.name,
        amountCents: amount,
      });
      debtor.remaining -= amount;
      creditor.remaining -= amount;
    }

    if (debtor.remaining === 0) i += 1;
    if (creditor.remaining === 0) j += 1;
  }

  return suggestions;
}

function toDateOnlyString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
