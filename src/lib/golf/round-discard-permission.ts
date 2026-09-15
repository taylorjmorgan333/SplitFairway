/**
 * Client-side gating for the "Discard Round"/"Delete Round" menu items
 * (Home's active-round cards, and the Round Details/Settings page for
 * a completed round) -- kept as one small pure function so both call
 * sites (src/app/(app)/home/page.tsx and
 * src/app/(app)/trips/[tripId]/rounds/[roundId]/page.tsx) agree, and so
 * the rule is directly unit-testable without a Supabase mock.
 *
 * This is UI-level gating only, purely to avoid showing a control that
 * would just fail -- the actual authorization is enforced
 * authoritatively in the database by discard_round()/restore_round()
 * (supabase/migrations/20260918100000_round_soft_delete.sql), which
 * re-checks the identical rule server-side and cannot be bypassed by
 * hiding or un-hiding this button.
 *
 * The rule itself, verbatim from the product spec: a Quick Round (a
 * hidden trip of kind 'quick_round' -- see trips.kind) can only be
 * discarded by the golfer who created it, since it only ever has one
 * real account attached; a Group Round or a real Trip Round can be
 * discarded by any of the trip's current captains/organizers.
 */

export type RoundHostTripKind = "trip" | "quick_round" | "group_round";

export interface CanDiscardRoundInput {
  tripKind: RoundHostTripKind;
  /** rounds.created_by for the round in question. */
  roundCreatedBy: string | null;
  /** The signed-in user evaluating whether they may discard/restore/delete this round. */
  currentUserId: string;
  /** Whether currentUserId is an active captain of the round's trip. */
  isCaptain: boolean;
}

export function canDiscardRound({ tripKind, roundCreatedBy, currentUserId, isCaptain }: CanDiscardRoundInput): boolean {
  if (tripKind === "quick_round") {
    return roundCreatedBy === currentUserId;
  }
  return isCaptain;
}
