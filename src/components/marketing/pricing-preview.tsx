import { Container } from "@/components/ui/container";
import { ButtonLink } from "@/components/ui/button";
import { PLANS } from "@/lib/billing/plans";

/**
 * A compact tier preview, not the full plan comparison (spec item 8).
 * Shows just name, price and one supporting line per plan, reading
 * from the same PLANS data as the full comparison so prices can never
 * drift between the two. The full feature-by-feature cards (PlanCard,
 * same component the signed-in /plans page uses) now live at the
 * public /pricing page instead of directly on the homepage.
 */
export function PricingPreview() {
  return (
    <section id="pricing" className="bg-forest-50 py-10 sm:py-20 lg:py-28">
      <Container>
        <div className="max-w-2xl">
          <h2 className="text-3xl sm:text-4xl">Simple pricing built for golf groups</h2>
          <p className="mt-3 text-lg text-charcoal-500">
            Play for free. Upgrade when you&apos;re ready to organize your group or run the trip.
          </p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className="rounded-2xl border border-forest-900/[0.08] bg-white p-5 shadow-card"
            >
              <p className="text-sm font-medium text-forest-900">{plan.name}</p>
              <p className="mt-1 font-serif text-2xl text-forest-900">{plan.price}</p>
              {plan.supportingText && (
                <p className="mt-2 text-xs text-charcoal-500">{plan.supportingText}</p>
              )}
            </div>
          ))}
        </div>

        <div className="mt-8">
          <ButtonLink href="/pricing" variant="outline" size="lg">
            Compare Plans
          </ButtonLink>
        </div>
      </Container>
    </section>
  );
}
