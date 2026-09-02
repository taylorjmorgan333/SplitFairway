"use client";

import { useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { dismissChecklist, isChecklistDismissed } from "@/lib/onboarding";

export type OnboardingChecklistStep = {
  key: string;
  label: string;
  description: string;
  done: boolean;
  /** Jumps the trip tabs to the right place — never a page navigation. */
  onGo?: () => void;
  goLabel?: string;
};

/**
 * A short, dismissible first-use checklist. Every "done" flag it renders
 * comes from real trip data passed in by the caller (or a real click the
 * person made in this browser) — never seeded or fabricated to make the
 * checklist look further along than it is.
 */
export function OnboardingChecklist({
  tripId,
  steps,
}: {
  tripId: string;
  steps: OnboardingChecklistStep[];
}) {
  const [dismissed, setDismissed] = useState(true); // default hidden until mounted, avoids SSR flash
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setDismissed(isChecklistDismissed(tripId));
    setMounted(true);
  }, [tripId]);

  if (!mounted) return null;

  const doneCount = steps.filter((s) => s.done).length;
  const allDone = doneCount === steps.length;

  if (dismissed) return null;

  return (
    <div className="rounded-2xl border border-gold-300/60 bg-gold-50 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-serif text-lg text-forest-900">Get your trip set up</h2>
          <p className="mt-1 text-sm text-charcoal-500">
            {allDone
              ? "You've done everything below — nice work."
              : `${doneCount} of ${steps.length} steps done. Finish these and everyone will know exactly what they owe.`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            dismissChecklist(tripId);
            setDismissed(true);
          }}
          aria-label="Hide this checklist"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-charcoal-400 hover:bg-gold-100 hover:text-charcoal-600"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <ol className="mt-4 space-y-2.5">
        {steps.map((step, i) => (
          <li
            key={step.key}
            className="flex flex-col gap-2 rounded-xl bg-white/70 p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-start gap-3">
              <span
                className={cn(
                  "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium",
                  step.done
                    ? "bg-forest-700 text-cream-50"
                    : "border border-forest-900/20 text-charcoal-500",
                )}
                aria-hidden="true"
              >
                {step.done ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </span>
              <div>
                <p
                  className={cn(
                    "text-sm font-medium",
                    step.done ? "text-charcoal-400 line-through" : "text-charcoal",
                  )}
                >
                  {step.label}
                </p>
                <p className="text-xs text-charcoal-400">{step.description}</p>
              </div>
            </div>
            {!step.done && step.onGo && (
              <button
                type="button"
                onClick={step.onGo}
                className="ml-9 self-start rounded-full border border-forest-800/20 px-3 py-1.5 text-xs font-medium text-forest-900 hover:bg-forest-50 sm:ml-0 sm:self-auto"
              >
                {step.goLabel ?? "Go"}
              </button>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
