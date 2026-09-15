"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/**
 * What Organizer Pro / Trip Pass "Choose ___" buttons open instead of a
 * real Stripe Checkout, which doesn't exist yet (spec item 6: "Do not
 * integrate Stripe yet ... do not send users to a broken checkout
 * page"). Intentionally does nothing stateful -- no DB write, no
 * localStorage, no navigation -- so clicking it can never leave the
 * golfer's account in a half-upgraded state; it only ever opens and
 * closes. This is also the one place a future Stripe integration hooks
 * in: swap the trigger below for a real "create Checkout session and
 * redirect" call once BILLING_ENABLED flips on, guarded by the same
 * flag this component's callers already check.
 */
export function ComingSoonTrigger({
  children,
  className,
}: {
  children: (open: () => void) => React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className={className}>
      {children(() => setOpen(true))}
      <Dialog open={open} onClose={() => setOpen(false)} title="Payments coming soon">
        <p className="text-sm text-charcoal-600">
          Organizer Pro and Trip Pass checkout will be available before launch. All premium
          features are unlocked during the SplitFairway beta.
        </p>
        <Button className="mt-5 w-full" onClick={() => setOpen(false)}>
          Continue Beta Access
        </Button>
      </Dialog>
    </div>
  );
}
