import { formatCurrency } from "@/lib/utils";
import type { MemberBalance, SettlementSuggestion } from "@/lib/balances";

/**
 * "Who owes what?" — shows each member's net confirmed position, then
 * the minimum set of suggested reimbursements to zero everyone out.
 * Purely a display: nothing here creates a payment record. A golfer
 * still reports the payment themselves (outside the app, then logged
 * here) once they've actually sent it, and a captain confirms it —
 * exactly like every other payment.
 */
export function SettlementView({
  balances,
  suggestions,
}: {
  balances: MemberBalance[];
  suggestions: SettlementSuggestion[];
}) {
  const owed = balances.filter((b) => b.netCents > 0).sort((a, b) => b.netCents - a.netCents);
  const owing = balances.filter((b) => b.netCents < 0).sort((a, b) => a.netCents - b.netCents);
  const settled = balances.filter((b) => b.netCents === 0);

  if (balances.length === 0) {
    return <p className="text-sm text-charcoal-500">No golfers to settle up yet.</p>;
  }

  if (owed.length === 0 && owing.length === 0) {
    return (
      <p className="text-sm text-forest-700">
        Everyone&apos;s settled up — confirmed payments match every golfer&apos;s share.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <ul className="space-y-1.5 text-sm">
        {owed.map((b) => (
          <li key={b.memberId} className="text-forest-700">
            <span className="font-medium">{b.displayName}</span> should receive{" "}
            {formatCurrency(b.amountDueBackCents)}
          </li>
        ))}
        {owing.map((b) => (
          <li key={b.memberId} className="text-gold-700">
            <span className="font-medium">{b.displayName}</span> owes {formatCurrency(b.amountOwedCents)}
          </li>
        ))}
        {settled.map((b) => (
          <li key={b.memberId} className="text-charcoal-400">
            <span className="font-medium text-charcoal-500">{b.displayName}</span> is settled up
          </li>
        ))}
      </ul>

      {suggestions.length > 0 && (
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-charcoal-400">
            Suggested payments
          </p>
          <ul className="mt-2 space-y-1.5 text-sm text-charcoal">
            {suggestions.map((s, i) => (
              <li key={`${s.fromMemberId}-${s.toMemberId}-${i}`}>
                <span className="font-medium">{s.fromName}</span> pays{" "}
                <span className="font-medium">{s.toName}</span> {formatCurrency(s.amountCents)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
