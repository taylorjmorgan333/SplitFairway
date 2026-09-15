import { Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PlanDefinition } from "@/lib/billing/plans";
import { ComingSoonTrigger } from "@/components/billing/coming-soon-dialog";

/**
 * One plan card on /plans. The Free card's button is inert plain text
 * ("Current Plan") since there's nothing to click through to yet --
 * every other plan's button opens ComingSoonTrigger, the one place
 * Stripe checkout will eventually replace a dialog with a real
 * redirect. `highlighted` gives Organizer Pro a slightly raised
 * treatment (the spec's "Best for regular groups" callout) without a
 * different structure from the other two cards.
 */
export function PlanCard({ plan, highlighted = false }: { plan: PlanDefinition; highlighted?: boolean }) {
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
            <Button variant="outline" className="w-full" disabled>
              Current Plan
            </Button>
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
