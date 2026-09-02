/**
 * Pure expense-splitting math. No DB access, no React — this is the one
 * place split calculations happen so the client (for preview) and the
 * server (for the value that actually gets saved) never disagree, and
 * so it can be unit-tested without a database.
 *
 * All amounts are integer cents. Never floating point.
 */

export type ExpenseShareCalc = {
  tripMemberId: string;
  amountOwedCents: number;
};

/**
 * Split `totalCents` evenly across `memberIds`.
 *
 * Integer division never divides perfectly, so there's almost always a
 * few cents left over (e.g. $100.00 / 3 = $33.33 with 1 cent left).
 * Those leftover cents are distributed one at a time, deterministically,
 * so the shares always sum to exactly `totalCents`: `memberIds` is
 * sorted ascending first (so the split doesn't depend on the order a
 * captain happened to select golfers in), then the first `remainder`
 * members in that sorted order each get one extra cent.
 *
 * Used for both "equal split among all active members" and "equal
 * split among selected members" — the caller decides which member IDs
 * to pass in; the math is identical either way.
 */
export function splitEqually(totalCents: number, memberIds: string[]): ExpenseShareCalc[] {
  if (!Number.isInteger(totalCents) || totalCents <= 0) {
    throw new Error("Expense amount must be a positive integer number of cents");
  }
  if (memberIds.length === 0) {
    throw new Error("At least one member is required to split an expense");
  }

  const sortedIds = [...memberIds].sort();
  const base = Math.floor(totalCents / sortedIds.length);
  const remainder = totalCents - base * sortedIds.length;

  return sortedIds.map((tripMemberId, index) => ({
    tripMemberId,
    amountOwedCents: base + (index < remainder ? 1 : 0),
  }));
}

export type SplitValidationResult = { valid: true } | { valid: false; error: string };

/**
 * Validate a custom, per-member dollar split: every share must be a
 * positive whole number of cents, there must be at least one share,
 * and — the hard rule — the shares must add up to EXACTLY the expense
 * total. No rounding, no "close enough."
 */
export function validateCustomSplit(
  totalCents: number,
  shares: ExpenseShareCalc[],
): SplitValidationResult {
  if (shares.length === 0) {
    return { valid: false, error: "Select at least one golfer to split this with." };
  }

  if (shares.some((s) => !Number.isInteger(s.amountOwedCents) || s.amountOwedCents <= 0)) {
    return {
      valid: false,
      error: "Every golfer's custom amount must be a valid, positive dollar figure.",
    };
  }

  const ids = new Set(shares.map((s) => s.tripMemberId));
  if (ids.size !== shares.length) {
    return { valid: false, error: "Each golfer can only appear once in a split." };
  }

  const sum = shares.reduce((total, s) => total + s.amountOwedCents, 0);
  if (sum !== totalCents) {
    return {
      valid: false,
      error: `Custom amounts add up to ${(sum / 100).toFixed(2)}, but the total is ${(totalCents / 100).toFixed(2)}. They need to match exactly.`,
    };
  }

  return { valid: true };
}

export type SplitMethod = "equal" | "selected" | "custom";

/**
 * Decide which split_method label applies to an equal split: "equal"
 * when every currently-active member was included, "selected" when
 * the captain chose a subset. (A "custom" split is always labeled by
 * the caller directly, since it's a distinct UI path.)
 */
export function equalSplitMethod(memberIds: string[], activeMemberCount: number): SplitMethod {
  return memberIds.length === activeMemberCount ? "equal" : "selected";
}
