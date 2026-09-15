import { Flag, Users, MapPin, Check } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { SectionLink } from "@/components/marketing/section-link";

type UseCase = {
  icon: typeof Flag;
  name: string;
  body: string;
  show: string[];
  cta: string;
  href: string;
};

const USE_CASES: UseCase[] = [
  {
    icon: Flag,
    name: "Quick Round",
    body: "Choose a course, add your golfers and start scoring in a few taps.",
    show: [
      "Mobile scorecard",
      "Gross and net leaderboard",
      "Optional games",
      "No trip or group required",
    ],
    cta: "Start a Round",
    href: "/signup",
  },
  {
    icon: Users,
    name: "Weekly Groups",
    body: "Save your regular golfers, handicaps, tees and favorite games once.",
    show: [
      "Saved roster",
      "Game presets",
      "Group seasons and standings",
      "Round history",
      "Group balances",
    ],
    cta: "Create a Group",
    href: "/signup",
  },
  {
    icon: MapPin,
    name: "Trip Mode",
    body: "Bring every round, reservation, expense and payment into one shared trip.",
    show: [
      "Multiple rounds",
      "Itinerary and lodging",
      "Expense splitting",
      "Payment tracking",
      "Trip leaderboard and recap",
    ],
    cta: "Explore Trip Mode",
    href: "#trip-mode",
  },
];

/**
 * The homepage's second section -- placed immediately below the hero
 * so all three ways to use SplitFairway (a single round, a standing
 * weekly group, or a full trip) get equal first-impression weight,
 * instead of the previous layout where everything before the fold was
 * trip-only. Card structure mirrors PlanCard (icon/title/body, a
 * flex-1 "show" list, a button pinned to the bottom) rather than
 * inventing a new card pattern.
 */
export function UseCasesSection() {
  return (
    <section id="use-cases" className="bg-cream-50 py-20 sm:py-28">
      <Container>
        <div className="max-w-2xl">
          <h2 className="text-3xl sm:text-4xl">Built for Saturday. Ready for Bandon.</h2>
          <p className="mt-4 text-lg text-charcoal-500">
            Use SplitFairway for today&apos;s round, the group you play with every week and the
            trip everyone talks about all year.
          </p>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {USE_CASES.map((useCase) => (
            <Card key={useCase.name} className="flex flex-col">
              <CardHeader className="pb-0">
                <useCase.icon
                  className="h-5 w-5 text-forest-700"
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
                <CardTitle className="mt-3">{useCase.name}</CardTitle>
                <p className="mt-1 text-sm text-charcoal-500">{useCase.body}</p>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col">
                <ul className="flex-1 space-y-2">
                  {useCase.show.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-charcoal-700">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-forest-600" aria-hidden="true" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <SectionLink href={useCase.href} variant="primary" className="mt-6 w-full">
                  {useCase.cta}
                </SectionLink>
              </CardContent>
            </Card>
          ))}
        </div>
      </Container>
    </section>
  );
}
