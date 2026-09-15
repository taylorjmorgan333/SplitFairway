/**
 * Structured copy for the three plans -- read by the /plans page and
 * (eventually) any other surface that shows plan comparisons or Pro
 * badges. Kept as plain data rather than JSX so the same list can drive
 * the Plans page cards, a future pricing email, or a shorter in-app
 * upsell without re-typing any copy. Exact wording matches the product
 * spec; changing prices/features here is the one place that needs it.
 */
export type PlanId = "free" | "organizer_pro" | "trip_pass";

export interface PlanDefinition {
  id: PlanId;
  name: string;
  price: string;
  /** One line shown right under the plan name for the two paid plans (Free has none). */
  supportingText?: string;
  /** Small secondary line under the price, e.g. the annual-to-monthly breakdown. */
  priceDetail?: string;
  /** Short label badge on the card, e.g. "Best for regular groups". */
  badge?: string;
  features: string[];
  buttonLabel: string;
}

export const PLANS: PlanDefinition[] = [
  {
    id: "free",
    name: "Free Player",
    price: "$0",
    features: [
      "Join unlimited groups and trips",
      "Start Quick Rounds",
      "Enter and view scores",
      "Basic scorecards and leaderboards",
      "Participate in games",
      "View balances and results",
      "Basic 19th Hole counters and recap",
    ],
    buttonLabel: "Continue Free",
  },
  {
    id: "organizer_pro",
    name: "Organizer Pro",
    price: "$59.99/year",
    supportingText: "Run your regular golf group all season.",
    priceDetail: "About $5/month, billed annually.",
    badge: "Best for regular groups",
    features: [
      "Create and manage recurring groups",
      "Unlimited Group Rounds",
      "Saved rosters, tees and game presets",
      "Group seasons and standings",
      "Advanced game and settlement tools",
      "Custom 19th Hole counters",
      "Group and all-time 19th Hole records",
      "Custom awards",
      "Shareable recap graphics",
      "Advanced group history",
    ],
    buttonLabel: "Choose Organizer Pro",
  },
  {
    id: "trip_pass",
    name: "Trip Pass",
    price: "$29.99/trip",
    supportingText: "One purchase unlocks the complete trip for everyone invited.",
    priceDetail: "One payment covers everyone invited.",
    badge: "Best for golf trips",
    features: [
      "Unlimited golfers for that trip",
      "Multiple trip rounds",
      "Trip itinerary and lodging details",
      "Trip expenses and payment tracking",
      "Trip games and leaderboard",
      "Full 19th Hole experience",
      "Trip-wide awards and records",
      "Final settlement",
      "End-of-trip recap",
    ],
    buttonLabel: "Choose a Trip Pass",
  },
];

export function planById(id: PlanId): PlanDefinition {
  const plan = PLANS.find((p) => p.id === id);
  if (!plan) throw new Error(`Unknown plan id: ${id}`);
  return plan;
}
