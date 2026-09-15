import type { RoundHostTripKind } from "@/lib/golf/round-discard-permission";

/**
 * The plain-language round type shown in the round heading's compact
 * details line ("Quick Round · September 15, 2026 · 18 holes") --
 * derived from the round's hosting trip's kind (trips.kind), the same
 * field discard permission already keys off of. One place for this
 * label so it can't drift between the round heading, the round hub
 * page, and anywhere else that names a round's type.
 */
const ROUND_TYPE_LABELS: Record<RoundHostTripKind, string> = {
  quick_round: "Quick Round",
  group_round: "Group Round",
  trip: "Trip Round",
};

export function roundTypeLabel(tripKind: RoundHostTripKind): string {
  return ROUND_TYPE_LABELS[tripKind];
}
