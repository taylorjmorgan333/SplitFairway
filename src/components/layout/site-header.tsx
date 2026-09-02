import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

const NAV_LINKS = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#pricing", label: "Pricing" },
  { href: "/#faq", label: "FAQ" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-forest-900/[0.06] bg-cream-50/90 backdrop-blur">
      <Container className="flex h-16 items-center justify-between">
        <Link href="/" aria-label="Golf Trip Treasurer home">
          <Logo />
        </Link>

        <nav
          aria-label="Primary"
          className="hidden items-center gap-8 md:flex"
        >
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

        <div className="flex items-center gap-3">
          <ButtonLink href="/login" variant="ghost" size="sm" className="hidden sm:inline-flex">
            Log in
          </ButtonLink>
          <ButtonLink href="/signup" variant="primary" size="sm">
            Create Your Trip
          </ButtonLink>
        </div>
      </Container>
    </header>
  );
}
