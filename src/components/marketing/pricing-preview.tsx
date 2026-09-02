import { Check } from "lucide-react";
import { Container } from "@/components/ui/container";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type Plan = {
  name: string;
  price: string;
  cadence: string;
  description: string;
  features: string[];
  featured: boolean;
} & ({ available: true; cta: string } | { available: false });

const PLANS: Plan[] = [
  {
    name: "One Trip",
    price: "Free",
    cadence: "",
    description: "Everything you need to run a single trip end to end.",
    features: [
      "Unlimited expenses and golfers",
      "Even or itemized splitting",
      "Payment tracking and reminders",
    ],
    featured: true,
    available: true,
    cta: "Create Your Trip",
  },
  {
    name: "Annual Organizer",
    price: "Coming later",
    cadence: "",
    description: "For the person who plans the trip every single year.",
    features: [
      "Everything in One Trip",
      "Unlimited trips, year-round",
      "Saved groups and trip history",
    ],
    featured: false,
    available: false,
  },
];

export function PricingPreview() {
  return (
    <section id="pricing" className="bg-cream-50 py-20 sm:py-28">
      <Container>
        <div className="max-w-2xl">
          <h2 className="text-3xl sm:text-4xl">Simple pricing, coming soon</h2>
          <p className="mt-4 text-lg text-charcoal-500">
            SplitFairway is free to use while we finish building it.
            Final pricing will only ever cover the software — never a cut of
            your group&apos;s money.
          </p>
        </div>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 sm:max-w-2xl">
          {PLANS.map((plan) => (
            <Card
              key={plan.name}
              className={
                plan.featured
                  ? "relative border-gold-400/60 ring-1 ring-gold-400/60"
                  : !plan.available
                    ? "opacity-70"
                    : ""
              }
            >
              {plan.featured && (
                <span className="absolute -top-3 left-6 rounded-full bg-gold-400 px-3 py-1 text-xs font-semibold text-forest-950">
                  Available now
                </span>
              )}
              {!plan.available && (
                <span className="absolute -top-3 left-6 rounded-full bg-cream-200 px-3 py-1 text-xs font-semibold text-charcoal-500">
                  Coming later
                </span>
              )}
              <div className="p-7">
                <h3 className="font-serif text-xl text-forest-900">{plan.name}</h3>
                <p className="mt-1 text-sm text-charcoal-500">{plan.description}</p>
                <p className="mt-5 flex items-baseline gap-1">
                  <span
                    className={
                      plan.available
                        ? "font-serif text-3xl text-forest-900"
                        : "font-serif text-xl text-charcoal-400"
                    }
                  >
                    {plan.price}
                  </span>
                  {plan.cadence && (
                    <span className="text-sm text-charcoal-400">{plan.cadence}</span>
                  )}
                </p>
                <ul className="mt-6 space-y-2.5">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-charcoal-700">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-forest-600" aria-hidden="true" />
                      {feature}
                    </li>
                  ))}
                </ul>
                {plan.available ? (
                  <ButtonLink href="/signup" variant="gold" className="mt-7 w-full">
                    {plan.cta}
                  </ButtonLink>
                ) : (
                  <div
                    aria-disabled="true"
                    className="mt-7 flex h-11 w-full items-center justify-center rounded-full border border-charcoal-400/20 text-sm font-medium text-charcoal-400"
                  >
                    Not available yet
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      </Container>
    </section>
  );
}
