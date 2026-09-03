import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { Container } from "@/components/ui/container";
import { ButtonLink } from "@/components/ui/button";
import { UserMenu } from "@/components/layout/user-menu";
import { GOLF_SCORING_ENABLED } from "@/lib/config";

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  // Golf scoring is still mid-build behind GOLF_SCORING_ENABLED — this
  // link only appears once that flag is on, same as the Account page's
  // golf profile section.
  ...(GOLF_SCORING_ENABLED ? [{ href: "/courses", label: "Courses" }] : []),
  { href: "/account", label: "Account" },
];

// The bottom tab bar mobile users actually drive the app with — the top
// nav row still exists (hidden below md) for anyone using a mouse or
// keyboard, but on a phone the thumb-reachable zone is the bottom of the
// screen, so the primary actions live there instead.
const MOBILE_TABS = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 10.5 12 3l9 7.5M5 9v11a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9"
      />
    ),
  },
  {
    href: "/trips/new",
    label: "New Trip",
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />,
  },
  {
    href: "/account",
    label: "Account",
    icon: (
      <>
        <circle cx="12" cy="8" r="3.5" strokeLinecap="round" strokeLinejoin="round" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 20a7.5 7.5 0 0 1 15 0" />
      </>
    ),
  },
];

export function AppShell({
  email,
  children,
}: {
  email: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-cream-50">
      <header className="safe-top sticky top-0 z-40 border-b border-forest-900/[0.06] bg-cream-50/90 backdrop-blur">
        <Container className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/dashboard" aria-label="SplitFairway home">
              <Logo className="scale-95" />
            </Link>
            <nav aria-label="Primary" className="hidden items-center gap-6 md:flex">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm font-medium text-charcoal-700 transition-colors hover:text-forest-800"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <ButtonLink
              href="/trips/new"
              variant="primary"
              size="sm"
              className="hidden sm:inline-flex"
            >
              New Trip
            </ButtonLink>
            <UserMenu email={email} />
          </div>
        </Container>
      </header>

      {/* Bottom-anchored so Dashboard / New Trip / Account stay within
          one-thumb reach on a phone, instead of requiring a stretch back
          up to the header. min-h-14 (56px) keeps each tab comfortably
          above the 44px touch-target minimum. */}
      <main className="flex-1 py-8 pb-24 sm:py-10 md:pb-10">
        <Container>{children}</Container>
      </main>

      <nav
        aria-label="Primary"
        className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-forest-900/[0.08] bg-cream-50/95 backdrop-blur md:hidden"
      >
        <div className="mx-auto flex max-w-content">
          {MOBILE_TABS.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className="flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-charcoal-600 active:bg-forest-900/[0.04]"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.75}
                className="h-5 w-5"
              >
                {tab.icon}
              </svg>
              <span className="text-[11px] font-medium">{tab.label}</span>
            </Link>
          ))}
        </div>
      </nav>

      {/* Sits in normal flow after <main>, so on a phone it scrolls in
          below the last section of page content; the extra bottom
          padding keeps its text from landing under the fixed tab bar. */}
      <footer className="safe-bottom border-t border-forest-900/[0.06] bg-cream-100/60 pt-6 pb-24 md:pb-6">
        <Container>
          <p className="text-xs text-charcoal-400">
            SplitFairway tracks expenses and payments — it doesn&apos;t book travel or
            hold your group&apos;s money. Every payment happens outside the app and is only
            reflected here once confirmed by the right person; trip captains remain responsible
            for verifying reservations and balances.{" "}
            <Link href="/legal/terms" className="underline hover:text-charcoal-500">
              Terms
            </Link>{" "}
            ·{" "}
            <Link href="/legal/privacy" className="underline hover:text-charcoal-500">
              Privacy
            </Link>{" "}
            ·{" "}
            <Link href="/contact" className="underline hover:text-charcoal-500">
              Contact
            </Link>
          </p>
        </Container>
      </footer>
    </div>
  );
}
