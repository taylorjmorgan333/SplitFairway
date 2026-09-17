"use client";

import { useId, useState } from "react";
import { Flag, Users, MapPin, Check } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { SectionLink } from "@/components/marketing/section-link";

type Way = {
  key: string;
  icon: typeof Flag;
  name: string;
  body: string;
  benefits: string[];
  cta: string;
  href: string;
};

/**
 * The three ways to use SplitFairway, in the order the homepage should
 * give equal first-impression weight: today's round, the weekly group,
 * then the trip. Each entry is capped at 3 benefits -- the fuller
 * explanations that used to live here (Weekly Groups' saved rosters,
 * presets and history; Trip Mode's expenses, lodging and settlement)
 * now live only in their own section (Weekly Groups) or their
 * dedicated page (Trip Mode -> /trip-mode), so nothing is explained
 * twice on the homepage.
 */
const WAYS: Way[] = [
  {
    key: "play-today",
    icon: Flag,
    name: "Play Today",
    body: "Choose a course and start scoring in a few taps.",
    benefits: ["Start a round in seconds", "Keep score and run the games", "Follow the live leaderboard"],
    cta: "Start a Round",
    href: "/signup",
  },
  {
    key: "weekly-groups",
    icon: Users,
    name: "Weekly Groups",
    body: "Save your regular golfers and settings once, then reuse them every week.",
    benefits: ["Save golfers, handicaps and tees", "Reuse your game presets", "Track standings and round history"],
    cta: "Create a Group",
    href: "/signup",
  },
  {
    key: "golf-trips",
    icon: MapPin,
    name: "Golf Trips",
    body: "Bring every round, expense and payment for the trip into one place.",
    benefits: ["Manage multiple rounds together", "Track lodging and expenses", "See final standings and payments"],
    cta: "Explore Trip Mode",
    href: "/trip-mode",
  },
];

function WayCard({ way }: { way: Way }) {
  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="pb-0">
        <way.icon className="h-5 w-5 text-forest-700" strokeWidth={1.75} aria-hidden="true" />
        <CardTitle className="mt-3">{way.name}</CardTitle>
        <p className="mt-1 text-sm text-charcoal-500">{way.body}</p>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        <ul className="flex-1 space-y-2">
          {way.benefits.map((item) => (
            <li key={item} className="flex items-start gap-2 text-sm text-charcoal-700">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-forest-600" aria-hidden="true" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <SectionLink href={way.href} variant="primary" className="mt-6 w-full">
          {way.cta}
        </SectionLink>
      </CardContent>
    </Card>
  );
}

/**
 * Replaces the old UseCasesSection. Same three destinations and the
 * same card shape (icon/title/body/benefits/action), but capped to 3
 * benefits each and, on mobile, shown one at a time behind tabs (spec
 * item 3) instead of three stacked full-height cards -- the single
 * biggest contributor to the old page's mobile length. Desktop keeps
 * all three side by side since there's room for it there.
 */
export function WaysToPlaySection() {
  const [active, setActive] = useState<string>(WAYS[0].key);
  const tablistId = useId();

  return (
    <section id="ways-to-play" className="bg-cream-50 py-10 sm:py-20 lg:py-28">
      <Container>
        <div className="max-w-2xl">
          <h2 className="text-3xl sm:text-4xl">Built for Saturday. Ready for Bandon.</h2>
          <p className="mt-3 text-lg text-charcoal-500">
            One app for today&apos;s round, the group you play every week and the trip everyone
            talks about all year.
          </p>
        </div>

        {/* Mobile: tabs, one panel visible at a time -- Play Today first/default */}
        <div className="mt-8 lg:hidden">
          <div
            role="tablist"
            aria-label="Ways to play"
            id={tablistId}
            className="flex w-full gap-1 rounded-full bg-cream-200 p-1"
          >
            {WAYS.map((way) => (
              <button
                key={way.key}
                type="button"
                role="tab"
                id={`${tablistId}-tab-${way.key}`}
                aria-selected={active === way.key}
                aria-controls={`${tablistId}-panel-${way.key}`}
                onClick={() => setActive(way.key)}
                className={
                  active === way.key
                    ? "flex-1 rounded-full bg-white px-2 py-2.5 text-sm font-medium text-forest-900 shadow-card"
                    : "flex-1 rounded-full px-2 py-2.5 text-sm text-charcoal-500 transition-colors hover:text-charcoal-700"
                }
              >
                {way.name}
              </button>
            ))}
          </div>

          {WAYS.map((way) => (
            <div
              key={way.key}
              role="tabpanel"
              id={`${tablistId}-panel-${way.key}`}
              aria-labelledby={`${tablistId}-tab-${way.key}`}
              hidden={active !== way.key}
              className="mt-5"
            >
              <WayCard way={way} />
            </div>
          ))}
        </div>

        {/* Desktop: all three ways side by side */}
        <div className="mt-14 hidden gap-6 lg:grid lg:grid-cols-3">
          {WAYS.map((way) => (
            <WayCard key={way.key} way={way} />
          ))}
        </div>
      </Container>
    </section>
  );
}
