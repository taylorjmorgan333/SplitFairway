import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { MobileNav } from "@/components/layout/mobile-nav";
import { SectionLink } from "@/components/marketing/section-link";

const NAV_LINKS = [
  { href: "/#how-it-works", label: "How It Works" },
  { href: "/#games", label: "Games & Groups" },
  { href: "/#trip-mode", label: "Trip Mode" },
  { href: "/#pricing", label: "Pricing" },
  { href: "/#faq", label: "FAQ" },
];

const MOBILE_LINKS = [...NAV_LINKS, { href: "/login", label: "Log in" }];

export function SiteHeader() {
  return (
    <header className="safe-top sticky top-0 z-40 border-b border-forest-900/[0.06] bg-cream-50/90 backdrop-blur">
      <Container className="flex h-16 items-center justify-between">
        <Link href="/" aria-label="SplitFairway home">
          <Logo />
        </Link>

        <nav
          aria-label="Primary"
          className="hidden items-center gap-7 md:flex"
        >
          {NAV_LINKS.map((link) => (
            <SectionLink
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-charcoal-700 transition-colors hover:text-forest-800"
            >
              {link.label}
            </SectionLink>
          ))}
        </nav>

        <div className="flex items-center gap-1 sm:gap-3">
          {/* Below sm there's only room for the primary CTA and the
              menu toggle -- Log in lives in MobileNav's link list
              there instead of competing for space. From sm up, the
              ghost button has room to stand on its own again. */}
          <ButtonLink href="/login" variant="ghost" size="sm" className="hidden sm:inline-flex">
            Log in
          </ButtonLink>
          <ButtonLink href="/signup" variant="primary" size="sm">
            Start Playing Free
          </ButtonLink>
          <MobileNav links={MOBILE_LINKS} />
        </div>
      </Container>
    </header>
  );
}
