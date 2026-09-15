import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { CompleteOnboardingButton } from "@/components/onboarding/complete-onboarding-button";
import { GOLF_SCORING_ENABLED } from "@/lib/config";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Welcome to SplitFairway" };

/**
 * Lightweight, three-step onboarding for new users only (spec item 8).
 * Lives outside the (app) route group deliberately -- src/app/(app)/layout.tsx
 * redirects here whenever profiles.onboarding_completed_at is null, and
 * this page is what lets a first-time user's session ever legitimately
 * *reach* an unblocked layout: if it if were itself under (app), that
 * redirect would loop forever. Each step links straight to the real
 * flow (creating/joining a group, adding golfers, starting a round)
 * rather than re-implementing any of them here -- this page's only job
 * is orientation, and completing it (or skipping) marks
 * onboarding_completed_at so a returning user never sees it again, on
 * any device.
 */
export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login?next=/onboarding");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_completed_at")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.onboarding_completed_at) {
    redirect("/dashboard");
  }

  const steps = [
    {
      number: 1,
      title: "Create or join a group",
      description:
        "A group is your regular foursome or club -- save it once and every round after this gets faster.",
      action: { href: "/groups/new", label: "Create a group" },
    },
    {
      number: 2,
      title: "Add or invite golfers",
      description:
        "Add the golfers you play with by name, or send them an invitation link so they can join themselves.",
      action: { href: "/groups", label: "Go to your groups" },
    },
    {
      number: 3,
      title: "Start your first round",
      description: GOLF_SCORING_ENABLED
        ? "Pick a course, confirm who's playing, and start keeping score -- it only takes a few taps."
        : "Scoring isn't turned on for this account yet -- you can still set up your group and trip.",
      action: GOLF_SCORING_ENABLED ? { href: "/play", label: "Start a round" } : null,
    },
  ];

  return (
    <div className="relative flex min-h-screen flex-col bg-forest-950">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-contour-lines opacity-40" />
      <div className="relative flex flex-1 flex-col items-center px-5 py-16">
        <Logo variant="light" />
        <h1 className="mt-8 text-2xl text-white">Welcome to SplitFairway</h1>
        <p className="mt-2 max-w-md text-center text-base text-cream-200/80">
          Three quick things, then you&apos;re all set.
        </p>

        <div className="mt-10 w-full max-w-lg space-y-5">
          {steps.map((step) => (
            <Card key={step.number}>
              <CardContent className="flex gap-4 p-5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-forest-800/10 text-base font-semibold text-forest-800">
                  {step.number}
                </span>
                <div className="min-w-0">
                  <p className="text-lg font-medium text-forest-900">{step.title}</p>
                  <p className="mt-1 text-base text-charcoal-500">{step.description}</p>
                  {step.action && (
                    <ButtonLink href={step.action.href} variant="outline" size="sm" className="mt-3">
                      {step.action.label}
                    </ButtonLink>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-10 w-full max-w-lg">
          <CompleteOnboardingButton next="/dashboard" />
        </div>
      </div>
    </div>
  );
}
