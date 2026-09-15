import { BILLING_ENABLED } from "@/lib/config";

/**
 * A Trip Pass is scoped to exactly one trip; Organizer Pro is scoped to
 * a recurring group (and, through it, that group's Group Rounds).
 * Both are optional: a caller checking a general/global feature (e.g.
 * "can this golfer see the Plans page") passes neither. Real
 * Stripe/webhook-backed lookups will key off whichever of these is
 * present -- e.g. "does trip_passes have a row for tripId" or "does
 * group_subscriptions have a row for groupId" -- without any caller of
 * getPlanEntitlements/canUse*Feature needing to change.
 */
export interface PlanEntitlementScope {
  groupId?: string | null;
  tripId?: string | null;
}

export interface PlanEntitlements {
  hasOrganizerPro: boolean;
  hasTripPass: boolean;
  /** True while billing is disabled and this access is beta-wide rather
   * than a real purchase -- lets UI show "Included with your beta
   * access" instead of implying the golfer actually bought a plan. */
  isBetaAccess: boolean;
}

/**
 * The one place that decides who has what. Pure function (no Supabase
 * call, no env read) so it's trivially unit-testable and so every
 * caller -- server component, server action, future client badge --
 * goes through the exact same rule instead of re-deciding it inline.
 *
 * billingEnabled=false (the whole beta today): every golfer gets full
 * access to both paid tiers, unconditionally, regardless of scope --
 * this is the literal implementation of "Give beta users access to all
 * working features" from the spec, and the reason no plan check should
 * ever be written directly against a `plan` column anywhere else in the
 * app.
 *
 * billingEnabled=true (future): falls through to a real lookup. Today
 * that lookup has nothing to query yet (no subscriptions/passes tables
 * exist), so it conservatively resolves to "no paid access" rather than
 * silently granting it -- replace this branch with real Supabase reads
 * (a `group_subscriptions` row for scope.groupId, a `trip_passes` row
 * for scope.tripId) when Stripe webhooks start writing those tables.
 * Nothing outside this function needs to change when that happens.
 */
export function computeEntitlements(
  billingEnabled: boolean,
  scope: PlanEntitlementScope = {},
): PlanEntitlements {
  void scope; // not yet read -- real billing branch will key off it (see doc comment above)

  if (!billingEnabled) {
    return { hasOrganizerPro: true, hasTripPass: true, isBetaAccess: true };
  }

  // TODO(stripe): replace with real subscription/pass lookups keyed by
  // scope.groupId (Organizer Pro) and scope.tripId (Trip Pass) once
  // Stripe checkout + webhooks exist. Until then, billing "on" with no
  // data source means no paid access, not fake access.
  return { hasOrganizerPro: false, hasTripPass: false, isBetaAccess: false };
}

/** Thin wrapper over computeEntitlements that reads the real BILLING_ENABLED flag -- the one function almost every caller should actually use. */
export function getPlanEntitlements(scope: PlanEntitlementScope = {}): PlanEntitlements {
  return computeEntitlements(BILLING_ENABLED, scope);
}

export function canUseOrganizerProFeature(scope: PlanEntitlementScope = {}): boolean {
  return getPlanEntitlements(scope).hasOrganizerPro;
}

export function canUseTripPassFeature(scope: PlanEntitlementScope = {}): boolean {
  return getPlanEntitlements(scope).hasTripPass;
}
