import type { Metadata } from "next";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { Container } from "@/components/ui/container";
import { PLANS } from "@/lib/billing/plans";
import { PlanCard } from "@/components/billing/plan-card";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Compare SplitFairway's plans — Free Player, Organizer Pro and Trip Pass — and see exactly what's included in each.",
  alternates: { canonical: "/pricing" },
};

/**
 * The full public plan comparison, moved here from the homepage (spec
 * item 8: the homepage now shows a compact preview with a "Compare
 * Plans" link to this page instead). Renders the exact same PLANS data
 * and PlanCard component as the signed-in /plans page and the old
 * homepage pricing section, so all three surfaces can never drift.
 *
 * Like the old homepage section, the Free card here gets a real
 * "Get Started Free" link (freeCta) since a visitor reaching this page
 * isn't signed in yet -- unlike /plans, which shows an inert
 * "Current Plan" button for an already-signed-in golfer.
 */
export default function PricingPage() {
  return (
    <>
      <SiteHeader />
      <main className="py-14 sm:py-20">
        <Container>
          <div className="max-w-2xl">
            <h1 className="text-3xl sm:text-4xl">Simple pricing built for golf groups</h1>
            <p className="mt-3 text-lg text-charcoal-500">
              Play for free. Upgrade when you&apos;re ready to organize your group or run the
              complete trip.
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {PLANS.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                highlighted={plan.id === "organizer_pro"}
                freeCta={plan.id === "free" ? { href: "/signup", label: "Get Started Free" } : undefined}
              />
            ))}
          </div>
        </Container>
      </main>
      <SiteFooter />
    </>
  );
}
