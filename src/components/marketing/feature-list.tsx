import { Calculator, Bell, Users, ListChecks, ShieldCheck, Smartphone, Trophy } from "lucide-react";
import { Container } from "@/components/ui/container";

const FEATURES = [
  {
    icon: Calculator,
    title: "Fair, flexible splitting",
    body: "Split evenly across the group or itemize who owes what for each expense.",
  },
  {
    icon: ListChecks,
    title: "One running ledger",
    body: "Every expense, every payment, in one place instead of scattered texts and screenshots.",
  },
  {
    icon: Bell,
    title: "Automatic reminders",
    body: "Nudge people who still owe money without being the one who has to ask twice.",
  },
  {
    icon: Users,
    title: "Built for the whole group",
    body: "Invite golfers to the trip so everyone can see the same numbers, not just the organizer.",
  },
  {
    icon: ShieldCheck,
    title: "You stay in control of the money",
    body: "We track who paid whom outside the app — Venmo, Zelle, PayPal, cash, check. We never hold your funds.",
  },
  {
    icon: Trophy,
    title: "Scores & side games",
    body: "Track scores, follow live standings and let SplitFairway handle the math for skins, Nassau and other group games.",
  },
  {
    icon: Smartphone,
    title: "Made for round day",
    body: "An easy, mobile-first scorecard designed for quick updates between shots.",
  },
];

export function FeatureList() {
  return (
    <section className="bg-forest-50 py-20 sm:py-28">
      <Container>
        <div className="max-w-2xl">
          <h2 className="text-3xl sm:text-4xl">Everything your golf trip needs</h2>
          <p className="mt-4 text-lg text-charcoal-500">
            From the first deposit to the final scorecard, the entire trip
            stays together.
          </p>
        </div>

        <div className="mt-14 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <div key={feature.title}>
              <feature.icon
                className="h-5 w-5 text-forest-700"
                strokeWidth={1.75}
                aria-hidden="true"
              />
              <h3 className="mt-4 text-base text-forest-900">{feature.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-charcoal-500">
                {feature.body}
              </p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
