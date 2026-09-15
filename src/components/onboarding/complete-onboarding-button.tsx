"use client";

import { useTransition } from "react";
import { completeOnboardingAction } from "@/actions/onboarding";
import { Button } from "@/components/ui/button";

export function CompleteOnboardingButton({ next }: { next: string }) {
  const [isPending, startTransition] = useTransition();
  return (
    <Button
      size="lg"
      className="w-full sm:w-auto"
      disabled={isPending}
      onClick={() => startTransition(() => completeOnboardingAction(next))}
    >
      {isPending ? "Taking you there…" : "Continue to your dashboard"}
    </Button>
  );
}
