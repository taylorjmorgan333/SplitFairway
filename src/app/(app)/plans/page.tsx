import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PLANS, planById } from "@/lib/billing/plans";
import { PlanCard } from "@/components/billing/plan-card";
import { BILLING_ENABLED } from "@/lib/config";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Plans" };

/**
 * The plan-comparison page linked from Account and from ProfileMenu.
 * Stripe isn't wired up yet (spec item 6), so every paid button here
 * opens ComingSoonTrigger's dialog instead of real checkout -- see
 * src/lib/billing/entitlements.ts for where the actual access decision
 * lives (BILLING_ENABLED off => everyone already has every feature
 * this page is selling, which is why the beta note appears on both
 * paid cards rather than only showing after a real purchase).
 */
const PLAN_CHOOSER: Array<{ question: string; planId: (typeof PLANS)[number]["id"] }> = [
  { question: "Joining and playing?", planId: "free" },
  { question: "Running a regular group?", planId: "organizer_pro" },
  { question: "Planning a golf trip?", planId: "trip_pass" },
];

export default async function PlansPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="mx-auto max-w-content">
      <h1 className="text-2xl">Plans</h1>
      <p className="mt-1.5 text-sm text-charcoal-500">
        Free for every golfer. Organizer Pro and Trip Pass add tools for the person running the
        group or the trip -- nobody else you invite ever pays.
      </p>
      {!BILLING_ENABLED && (
        <p className="mt-3 rounded-lg bg-gold-100 px-3.5 py-2.5 text-sm text-gold-800">
          SplitFairway is in beta — every plan below is fully unlocked for you right now, at no
          charge.
        </p>
      )}

      <div className="mt-6 grid gap-5 md:grid-cols-3">
        {PLANS.map((plan) => (
          <PlanCard key={plan.id} plan={plan} highlighted={plan.id === "organizer_pro"} />
        ))}
      </div>

      <div className="mt-8 max-w-xl">
        <p className="text-sm font-medium text-forest-900">Which plan is right for you?</p>
        <ul className="mt-3 space-y-2 text-sm text-charcoal-500">
          {PLAN_CHOOSER.map(({ question, planId }) => (
            <li key={planId}>
              {question} <span className="font-semibold text-forest-900">{planById(planId).name}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
