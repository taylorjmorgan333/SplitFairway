import { Container } from "@/components/ui/container";
import { PLANS } from "@/lib/billing/plans";
import { PlanCard } from "@/components/billing/plan-card";

/**
 * The public "Pricing" section (id="pricing", linked from nav as
 * /#pricing -- there is no standalone /pricing route). Renders the
 * exact same PLANS data and PlanCard component as the signed-in
 * /plans page (src/app/(app)/plans/page.tsx) so the two surfaces can
 * never drift: no local copy of names, prices, or features lives here.
 *
 * The only difference from /plans is the Free card's button -- a
 * visitor here isn't signed in yet, so `freeCta` swaps /plans' inert
 * "Current Plan" for a real "Get Started Free" link to /signup, which
 * itself offers a "sign in instead" path for existing users.
 */
export function PricingPreview() {
  return (
    <section id="pricing" className="bg-cream-50 py-20 sm:py-28">
      <Container>
        <div className="max-w-2xl">
          <h2 className="text-3xl sm:text-4xl">Simple pricing built for golf groups</h2>
          <p className="mt-4 text-lg text-charcoal-500">
            Play for free. Upgrade when you&apos;re ready to organize your group or run the
            complete trip.
          </p>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
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
    </section>
  );
}
