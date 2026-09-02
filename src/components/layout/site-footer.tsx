import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { Container } from "@/components/ui/container";

const PRODUCT_LINKS = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#pricing", label: "Pricing" },
  { href: "/#faq", label: "FAQ" },
];

const ACCOUNT_LINKS = [
  { href: "/signup", label: "Create your trip" },
  { href: "/login", label: "Log in" },
];

const LEGAL_LINKS = [
  { href: "/legal/privacy", label: "Privacy Policy" },
  { href: "/legal/terms", label: "Terms of Service" },
  { href: "/legal/data-deletion", label: "Data deletion" },
  { href: "/contact", label: "Contact" },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-forest-900/[0.06] bg-forest-950 text-cream-100">
      <Container className="grid gap-10 py-14 sm:grid-cols-2 md:grid-cols-4">
        <div className="sm:col-span-2 md:col-span-2">
          <Logo variant="light" />
          <p className="mt-4 max-w-sm text-sm text-cream-100/70">
            Payment tracking for golf trip organizers. We help you split
            costs and see who&apos;s paid — we never hold or move your
            group&apos;s money.
          </p>
        </div>

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gold-300/90">
            Product
          </h3>
          <ul className="mt-4 space-y-2.5">
            {PRODUCT_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="text-sm text-cream-100/75 transition-colors hover:text-cream-50"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gold-300/90">
            Account
          </h3>
          <ul className="mt-4 space-y-2.5">
            {ACCOUNT_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="text-sm text-cream-100/75 transition-colors hover:text-cream-50"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gold-300/90">
            Legal
          </h3>
          <ul className="mt-4 space-y-2.5">
            {LEGAL_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="text-sm text-cream-100/75 transition-colors hover:text-cream-50"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </Container>

      <div className="contour-divider" />

      <Container className="py-6">
        <ul className="grid gap-x-6 gap-y-1.5 text-xs text-cream-100/60 sm:grid-cols-2">
          <li>• We don&apos;t book travel — every reservation is made directly with the vendor.</li>
          <li>• We don&apos;t hold or transfer money — every payment happens outside the app.</li>
          <li>• Payment records are only real once the right person confirms them.</li>
          <li>• Trip captains are responsible for verifying reservations and balances.</li>
        </ul>
        <p className="mt-4 border-t border-cream-100/10 pt-4 text-xs text-cream-100/50">
          © {new Date().getFullYear()} Golf Trip Treasurer. All rights reserved. Currently in
          private beta.
        </p>
      </Container>
    </footer>
  );
}
