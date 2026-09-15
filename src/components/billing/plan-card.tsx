"use client";

import { Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PlanDefinition } from "@/lib/billing/plans";
import { ComingSoonTrigger } from "@/components/billing/coming-soon-dialog";

/**
 * "use client" is required here, not optional: this card hands
 * ComingSoonTrigger a render-prop function
 * (`{(open) => <Button onClick={open}>...}`), and a function can never
 * cross the Server->Client serialization boundary. As a Server
 * Component this built fine locally but broke the instant a *static*
 * page rendered it (Next tries to serialize the RSC payload at build
 * time and fails with "Functions cannot be passed directly to Client
 * Components") -- /plans avoided that failure only because it's
 * force-dynamic, which defers the identical serialization to
 * request time instead of catching it at build time. Making the whole
 * card a Client Component removes the boundary entirely, fixing both
 * the homepage prerender failure and the latent per-request risk on
 * /plans. Nothing here needs server-only data, so this is free.
 *
 * One plan card, shared by the signed-in /plans page and the public
 * pricing section (marketing/pricing-preview.tsx) so both surfaces stay
 * factually and visually identical -- the only thing that ever differs
 * between them is what the Free card's button does, via `freeCta`.
 *
 * On /plans (no `freeCta` passed), the Free card's button is inert
 * plain text ("Current Plan") since a signed-in golfer is already on
 * it. On the public page, `freeCta` swaps that for a real link (e.g.
 * "Get Started Free" -> /signup) since a visitor has nothing to be
 * "current" yet -- see the spec's "Free users should be directed to
 * sign up or sign in."
 *
 * Every other plan's button opens ComingSoonTrigger, the one place
 * Stripe checkout will eventually replace a dialog with a real
 * redirect. `highlighted` gives Organizer Pro a slightly raised
 * treatment (the spec's "Best for regular groups" callout) without a
 * different structure from the other two cards.
 */
export function PlanCard({
  plan,
  highlighted = false,
  freeCta,
}: {
  plan: PlanDefinition;
  highlighted?: boolean;
  /** Only used for plan.id === "free". Omit to keep /plans' disabled "Current Plan" button. */
  freeCta?: { href: string; label: string };
}) {
  return (
    <Card
      className={cn(
        "flex flex-col",
        highlighted && "border-gold-400/60 ring-1 ring-gold-400/60",
      )}
    >
      <CardHeader className="pb-0">
        {plan.badge && (
          <Badge variant="gold" className="mb-3 w-fit">
            {plan.badge}
          </Badge>
        )}
        <CardTitle>{plan.name}</CardTitle>
        {plan.supportingText && <p className="mt-1 text-sm text-charcoal-500">{plan.supportingText}</p>}
        <p className="mt-4 font-serif text-3xl text-forest-900">{plan.price}</p>
        {plan.priceDetail && <p className="mt-1 text-xs text-charcoal-400">{plan.priceDetail}</p>}
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        <ul className="flex-1 space-y-2.5">
          {plan.features.map((feature) => (
            <li key={feature} className="flex items-start gap-2 text-sm text-charcoal-700">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-forest-600" aria-hidden="true" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>

        <div className="mt-6">
          {plan.id === "free" ? (
            freeCta ? (
              <ButtonLink href={freeCta.href} variant={highlighted ? "gold" : "primary"} className="w-full">
                {freeCta.label}
              </ButtonLink>
            ) : (
              <Button variant="outline" className="w-full" disabled>
                Current Plan
              </Button>
            )
          ) : (
            <>
              <ComingSoonTrigger>
                {(open) => (
                  <Button
                    variant={highlighted ? "gold" : "primary"}
                    className="w-full"
                    onClick={open}
                  >
                    {plan.buttonLabel}
                  </Button>
                )}
              </ComingSoonTrigger>
              <p className="mt-2 text-center text-xs text-charcoal-400">
                Included with your beta access — no charge today.
              </p>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
