import { Calculator, ListChecks, Wallet, Bell, CalendarDays, Trophy, ShieldCheck } from "lucide-react";
import { Container } from "@/components/ui/container";

const TRIP_FEATURES = [
  {
    icon: Calculator,
    title: "Fair expense splitting",
    body: "Split evenly across the group or itemize who owes what for each expense.",
  },
  {
    icon: ListChecks,
    title: "One running ledger",
    body: "Every expense, every payment, in one place instead of scattered texts and screenshots.",
  },
  {
    icon: Wallet,
    title: "Payment tracking",
    body: "See who's paid and who still owes at a glance, all trip long.",
  },
  {
    icon: Bell,
    title: "Reminders",
    body: "Nudge people who still owe money without being the one who has to ask twice.",
  },
  {
    icon: CalendarDays,
    title: "Multiple rounds",
    body: "Keep every round of the trip, and its scores, together in one place.",
  },
  {
    icon: Trophy,
    title: "Trip games",
    body: "Run skins, Nassau and other games across the whole trip, not just one round.",
  },
  {
    icon: ShieldCheck,
    title: "Final settlement",
    body: "See the final balances and mark everyone paid once the trip wraps.",
  },
] as const;

/**
 * Trip Mode's dedicated feature section -- deliberately positioned in
 * the second half of the homepage (after the round/games/groups/19th
 * Hole sections) rather than in the hero, so it reads as one powerful
 * mode among several rather than the whole product. The trip ledger
 * sample immediately below this (DashboardPreview, unchanged) is the
 * other half of this section's story.
 */
export function TripModeSection() {
  return (
    <section id="trip-mode" className="bg-forest-50 py-20 sm:py-28">
      <Container>
        <div className="max-w-2xl">
          <h2 className="text-3xl sm:text-4xl">When the group travels, Trip Mode takes over.</h2>
          <p className="mt-4 text-lg text-charcoal-500">
            Keep the rounds, itinerary, lodging, expenses, payments and final standings together
            from the first deposit through the 19th Hole.
          </p>
        </div>

        <div className="mt-14 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {TRIP_FEATURES.map((feature) => (
            <div key={feature.title}>
              <feature.icon
                className="h-5 w-5 text-forest-700"
                strokeWidth={1.75}
                aria-hidden="true"
              />
              <h3 className="mt-4 text-base text-forest-900">{feature.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-charcoal-500">{feature.body}</p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
