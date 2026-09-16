import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { Container } from "@/components/ui/container";
import { GuestAccountUpsell } from "@/components/auth/guest-account-upsell";

/**
 * The minimal chrome a passwordless guest sees instead of the full
 * AppShell (spec item 1: "without navigating the entire app") --
 * no nav tabs to Dashboard/Trips/Groups/Account, since a guest has no
 * reason to browse any of that and most of it would just show empty
 * states for them anyway. Just a header and, always visible while
 * they're playing, the account-creation upsell -- not gated to only
 * appear after finishing, since a guest might close the browser
 * mid-round and never see a "you're done" screen at all.
 */
export function GuestShell({ guestName, children }: { guestName?: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-cream-50">
      <header className="safe-top sticky top-0 z-40 border-b border-forest-900/[0.06] bg-cream-50/90 backdrop-blur">
        <Container className="flex h-16 items-center justify-between">
          <Link href="/" aria-label="SplitFairway home">
            <Logo className="scale-95" />
          </Link>
          <p className="text-xs font-medium text-charcoal-500">
            Scoring as {guestName ?? "Guest"}
          </p>
        </Container>
      </header>
      {/* No tab bar here (a guest has nowhere else to navigate), but
          FeedbackButton (layout.tsx, rendered site-wide) still shows --
          same bottom clearance as AppShell's <main> so nothing at the
          end of a guest's scorecard renders underneath it. */}
      <main className="flex-1 pb-[calc(8.5rem+env(safe-area-inset-bottom))] md:pb-10">
        <Container className="py-6">
          <GuestAccountUpsell />
          {children}
        </Container>
      </main>
    </div>
  );
}
