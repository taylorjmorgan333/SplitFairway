import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { Container } from "@/components/ui/container";
import { ButtonLink } from "@/components/ui/button";
import { ProfileMenu } from "@/components/layout/profile-menu";
import { DesktopNav, MobileTabs } from "@/components/layout/primary-nav";

export function AppShell({
  email,
  isAdmin = false,
  children,
}: {
  email: string;
  isAdmin?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-cream-50">
      <header className="safe-top sticky top-0 z-40 border-b border-forest-900/[0.06] bg-cream-50/90 backdrop-blur">
        <Container className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/home" aria-label="SplitFairway home">
              <Logo className="scale-95" />
            </Link>
            <DesktopNav />
          </div>

          <div className="flex items-center gap-3">
            {isAdmin && (
              <Link
                href="/admin/golfcourseapi"
                className="hidden text-sm font-medium text-charcoal-700 transition-colors hover:text-forest-800 md:inline"
              >
                Admin
              </Link>
            )}
            <ButtonLink
              href="/play"
              variant="gold"
              size="sm"
              className="hidden sm:inline-flex"
            >
              Start a Round
            </ButtonLink>
            <ProfileMenu email={email} />
          </div>
        </Container>
      </header>

      {/* Bottom-anchored tab bar keeps Home / Play / Groups / Trips /
          Account within one-thumb reach on a phone. min-h-14 (56px)
          keeps each tab comfortably above the 44px touch-target
          minimum; Play itself is 56px. */}
      <main className="flex-1 py-8 pb-24 sm:py-10 md:pb-10">
        <Container>{children}</Container>
      </main>

      <MobileTabs />

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
