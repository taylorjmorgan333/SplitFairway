import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { Container } from "@/components/ui/container";
import { ButtonLink } from "@/components/ui/button";
import { UserMenu } from "@/components/layout/user-menu";

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/account", label: "Account" },
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
      <header className="sticky top-0 z-40 border-b border-forest-900/[0.06] bg-cream-50/90 backdrop-blur">
        <Container className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/dashboard" aria-label="Golf Trip Treasurer home">
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

        <nav
          aria-label="Primary"
          className="flex items-center gap-5 overflow-x-auto border-t border-forest-900/[0.06] px-5 py-2.5 md:hidden"
        >
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="whitespace-nowrap text-sm font-medium text-charcoal-700"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="flex-1 py-8 sm:py-10">
        <Container>{children}</Container>
      </main>
    </div>
  );
}
