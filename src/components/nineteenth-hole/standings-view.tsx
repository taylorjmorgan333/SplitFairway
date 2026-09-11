"use client";

import { cn } from "@/lib/utils";
import { POSITIVE_ACHIEVEMENT_KEYS } from "@/lib/validation/nineteenth-hole";
import type {
  NineteenthHoleActivityEntry,
  NineteenthHoleCounter,
  NineteenthHoleMember,
  NineteenthHoleRound,
} from "@/components/nineteenth-hole/types";

type Standing = { memberId: string; displayName: string; count: number; rank: number };

function buildStandings(
  members: NineteenthHoleMember[],
  activity: NineteenthHoleActivityEntry[],
  counterId: string,
  roundId: string | null,
): Standing[] {
  const totals = new Map<string, number>(members.map((m) => [m.id, 0]));
  for (const a of activity) {
    if (a.deletedAt !== null || a.counterId !== counterId) continue;
    if (roundId !== null && a.roundId !== roundId) continue;
    totals.set(a.tripMemberId, (totals.get(a.tripMemberId) ?? 0) + a.quantity);
  }

  const rows = members
    .map((m) => ({ memberId: m.id, displayName: m.displayName, count: totals.get(m.id) ?? 0 }))
    .sort((a, b) => b.count - a.count);

  let rank = 0;
  let lastCount: number | null = null;
  return rows.map((row, i) => {
    if (lastCount === null || row.count !== lastCount) {
      rank = i + 1;
      lastCount = row.count;
    }
    return { ...row, rank };
  });
}

function StandingsList({ standings, unitLabel }: { standings: Standing[]; unitLabel: string }) {
  if (standings.every((s) => s.count === 0)) {
    return <p className="text-sm text-charcoal-400">Nothing recorded yet.</p>;
  }
  return (
    <ul className="space-y-1.5">
      {standings.map((s) => (
        <li key={s.memberId} className="flex items-center justify-between text-base">
          <span className="text-charcoal-700">
            {s.rank}. {s.displayName}
          </span>
          <span className="font-medium text-forest-900">
            {s.count} <span className="text-sm font-normal text-charcoal-400">{unitLabel}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export function NineteenthHoleStandings({
  members,
  rounds,
  counters,
  activity,
  selectedCounterId,
  onSelectCounter,
  selectedRoundId,
  onSelectRound,
}: {
  members: NineteenthHoleMember[];
  rounds: NineteenthHoleRound[];
  counters: NineteenthHoleCounter[];
  activity: NineteenthHoleActivityEntry[];
  selectedCounterId: string | null;
  onSelectCounter: (counterId: string) => void;
  selectedRoundId: string | null;
  onSelectRound: (roundId: string | null) => void;
}) {
  const activeCounters = [...counters].filter((c) => c.isActive).sort((a, b) => a.sortOrder - b.sortOrder);
  const selectedCounter = activeCounters.find((c) => c.id === selectedCounterId) ?? activeCounters[0] ?? null;

  if (activeCounters.length === 0 || !selectedCounter) {
    return <p className="text-sm text-charcoal-500">No counters are active yet.</p>;
  }

  const isPositive = selectedCounter.isDefault && POSITIVE_ACHIEVEMENT_KEYS.has(selectedCounter.key);
  const heading = isPositive ? `Most ${selectedCounter.label.toLowerCase()}` : `${selectedCounter.label} leaderboard`;
  const unitLabel = selectedCounter.label.toLowerCase();

  const tripStandings = buildStandings(members, activity, selectedCounter.id, null);
  const roundStandings = selectedRoundId
    ? buildStandings(members, activity, selectedCounter.id, selectedRoundId)
    : null;
  const selectedRoundLabel = rounds.find((r) => r.id === selectedRoundId)?.label ?? null;

  return (
    <div className="space-y-4">
      <div className="-mx-5 overflow-x-auto px-5 sm:mx-0 sm:px-0">
        <div className="flex w-fit gap-1.5">
          {activeCounters.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onSelectCounter(c.id)}
              className={cn(
                "shrink-0 whitespace-nowrap rounded-full px-4 py-2.5 text-base font-medium transition-colors",
                selectedCounter.id === c.id
                  ? "bg-forest-800 text-cream-50"
                  : "bg-cream-100 text-charcoal-600 hover:bg-cream-200",
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {rounds.length > 0 && (
        <div>
          <label className="mb-1 block text-xs font-medium text-charcoal-500" htmlFor="standingsRound">
            Also show this round
          </label>
          <select
            id="standingsRound"
            value={selectedRoundId ?? ""}
            onChange={(e) => onSelectRound(e.target.value || null)}
            className="h-11 w-full rounded-lg border border-charcoal-400/25 bg-white px-3.5 text-base text-charcoal focus:border-forest-600 sm:w-auto"
          >
            <option value="">Trip total only</option>
            {rounds.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {roundStandings && (
        <div className="rounded-2xl border border-forest-900/[0.06] bg-white p-4 shadow-card">
          <p className="text-xs font-medium uppercase tracking-wide text-charcoal-400">
            {selectedRoundLabel} — {heading}
          </p>
          <div className="mt-2">
            <StandingsList standings={roundStandings} unitLabel={unitLabel} />
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-forest-900/[0.06] bg-white p-4 shadow-card">
        <p className="text-xs font-medium uppercase tracking-wide text-charcoal-400">
          Trip total — {heading}
        </p>
        <div className="mt-2">
          <StandingsList standings={tripStandings} unitLabel={unitLabel} />
        </div>
      </div>
    </div>
  );
}
