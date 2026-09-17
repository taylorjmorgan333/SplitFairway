import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { Container } from "@/components/ui/container";
import { SectionLink } from "@/components/marketing/section-link";

const PRODUCT_LINKS = [
  { href: "/#how-it-works", label: "How It Works" },
  { href: "/#games", label: "Games & Groups" },
  { href: "/trip-mode", label: "Trip Mode" },
  { href: "/pricing", label: "Pricing" },
  { href: "/faq", label: "FAQ" },
];

const ACCOUNT_LINKS = [
  { href: "/signup", label: "Start Playing Free" },
  { href: "/login", label: "Log in" },
];

const LEGAL_LINKS = [
  { href: "/legal/privacy", label: "Privacy Policy" },
  { href: "/legal/terms", label: "Terms of Service" },
  { href: "/legal/data-deletion", label: "Data deletion" },
  { href: "/contact", label: "Contact" },
];

const FOOTER_COLUMNS: { title: string; links: { href: string; label: string }[] }[] = [
  { title: "Product", links: PRODUCT_LINKS },
  { title: "Account", links: ACCOUNT_LINKS },
  { title: "Legal", links: LEGAL_LINKS },
];

/** A plain <a> for legal/account links (external navigation, no
 * same-page hash to intercept) vs. SectionLink for Product links,
 * some of which are still same-page anchors on the homepage. */
function FooterLink({ href, label }: { href: string; label: string }) {
  const isHash = href.includes("#");
  const className = "text-sm text-cream-100/75 transition-colors hover:text-cream-50";
  return isHash ? (
    <SectionLink href={href} className={className}>
      {label}
    </SectionLink>
  ) : (
    <Link href={href} className={className}>
      {label}
    </Link>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-forest-900/[0.06] bg-forest-950 text-cream-100">
      <Container className="py-10 sm:py-14">
        <div className="max-w-sm">
          <Logo variant="light" />
          <p className="mt-4 text-sm text-cream-100/70">
            Scores, side games, weekly groups and golf trips—all in one place.
          </p>
        </div>

        {/* Mobile: each category collapses behind a native <details>
            disclosure so the footer doesn't add a full extra screen of
            always-visible links on a phone (spec item 9). No JS
            needed -- <details>/<summary> handle expand/collapse
            natively. */}
        <div className="mt-8 divide-y divide-cream-100/10 sm:hidden">
          {FOOTER_COLUMNS.map((col) => (
            <details key={col.title} className="group py-4 first:pt-0">
              <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-semibold uppercase tracking-wide text-gold-300/90 [&::-webkit-details-marker]:hidden">
                {col.title}
                <ChevronDown
                  className="h-4 w-4 text-cream-100/50 transition-transform duration-200 group-open:rotate-180"
                  aria-hidden="true"
                />
              </summary>
              <ul className="mt-3 space-y-2.5 pb-1">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <FooterLink href={link.href} label={link.label} />
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </div>

        {/* Desktop: always-expanded columns, same content */}
        <div className="mt-10 hidden gap-10 sm:grid sm:grid-cols-3">
          {FOOTER_COLUMNS.map((col) => (
            <div key={col.title}>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gold-300/90">
                {col.title}
              </h3>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <FooterLink href={link.href} label={link.label} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
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
          © {new Date().getFullYear()} SplitFairway. All rights reserved. Currently in
          private beta.
        </p>
      </Container>
    </footer>
  );
}
