import { cn, formatCurrency } from "@/lib/utils";
import type { MemberBalance } from "@/lib/balances";

/**
 * One card per trip member showing every field the balance module
 * computes for them. This is the "Golfers" / Overview building block —
 * it never computes anything itself, it only renders MemberBalance
 * objects produced by src/lib/balances.ts.
 */
export function BalanceCards({
  balances,
  currentMemberId,
}: {
  balances: MemberBalance[];
  currentMemberId: string | null;
}) {
  if (balances.length === 0) {
    return <p className="text-sm text-charcoal-500">No active golfers yet.</p>;
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {balances.map((balance) => (
        <BalanceCard
          key={balance.memberId}
          balance={balance}
          isSelf={balance.memberId === currentMemberId}
        />
      ))}
    </div>
  );
}

function BalanceCard({ balance, isSelf }: { balance: MemberBalance; isSelf: boolean }) {
  const isSettled = balance.netCents === 0;

  return (
    <div className="rounded-xl border border-forest-900/[0.08] bg-cream-100 p-4">
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <p className="min-w-0 break-words text-sm font-medium text-charcoal">
          {balance.displayName}
          {isSelf && <span className="text-charcoal-400"> (you)</span>}
        </p>
        <span
          className={
            isSettled
              ? "shrink-0 text-xs font-medium tabular-nums text-forest-700"
              : balance.netCents > 0
                ? "shrink-0 text-xs font-medium tabular-nums text-forest-700"
                : "shrink-0 text-xs font-medium tabular-nums text-gold-700"
          }
        >
          {isSettled
            ? "Settled up"
            : balance.netCents > 0
              ? `Owed ${formatCurrency(balance.amountDueBackCents)}`
              : `Owes ${formatCurrency(balance.amountOwedCents)}`}
        </span>
      </div>

      <dl className="mt-3 space-y-1.5 text-xs text-charcoal-500">
        <Row label="Total trip share" value={formatCurrency(balance.totalShareCents)} />
        <Row label="Paid toward expenses" value={formatCurrency(balance.paidTowardExpensesCents)} />
        <Row label="Reimbursements sent" value={formatCurrency(balance.reimbursementsSentCents)} />
        <Row label="Reimbursements received" value={formatCurrency(balance.reimbursementsReceivedCents)} />
        {balance.upcomingDueCents > 0 && (
          <Row label="Upcoming due" value={formatCurrency(balance.upcomingDueCents)} emphasize />
        )}
      </dl>
    </div>
  );
}

function Row({ label, value, emphasize }: { label: string; value: string; emphasize?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="min-w-0">{label}</dt>
      <dd
        className={cn(
          "shrink-0 tabular-nums",
          emphasize ? "font-medium text-gold-700" : "text-charcoal-600",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
