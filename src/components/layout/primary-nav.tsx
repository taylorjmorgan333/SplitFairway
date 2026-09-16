"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Flag, Users, Luggage, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The five-item primary nav for both desktop and the mobile bottom bar
 * ("Home, Play, Groups, Trips, Account") -- one shared list so the two
 * surfaces can never drift out of sync with each other. Play is always
 * plain-labeled text next to its icon (never an icon alone), same as
 * every other item -- the only thing that makes Play "prominent" on
 * mobile is its own layout treatment in the bottom bar below, not a
 * different label style.
 */
export const NAV_ITEMS = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/play", label: "Play", icon: Flag },
  { href: "/groups", label: "Groups", icon: Users },
  { href: "/trips", label: "Trips", icon: Luggage },
  { href: "/account", label: "Account", icon: UserRound },
] as const;

// The mobile bottom bar reads Home, Groups, Play, Trips, Account --
// Play dead center as the primary action -- while DesktopNav (below)
// keeps NAV_ITEMS' own order untouched. Kept as a separate list rather
// than reordering NAV_ITEMS itself so the two surfaces can vary
// independently without one layout's ordering need leaking into the
// other's.
const MOBILE_TAB_ORDER = ["/home", "/groups", "/play", "/trips", "/account"] as const;

function isActive(pathname: string, href: string) {
  if (href === "/home") return pathname === "/home" || pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DesktopNav() {
  const pathname = usePathname();
  // "Account" is dropped from the desktop row only -- it's one of the
  // five tabs a phone needs (no room there for a separate profile
  // menu), but on desktop it would just duplicate the Account link
  // already inside ProfileMenu, right next to Plans/Settings/Sign Out.
  const items = NAV_ITEMS.filter((item) => item.href !== "/account");
  return (
    <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
      {items.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-11 items-center gap-2 rounded-full px-4 text-sm font-medium transition-colors",
              active
                ? "bg-forest-800/[0.08] text-forest-900"
                : "text-charcoal-700 hover:bg-forest-800/5 hover:text-forest-900",
            )}
          >
            <item.icon className="h-4 w-4" aria-hidden="true" strokeWidth={2} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * Bottom-anchored so every tab stays within one-thumb reach on a phone.
 * Play (starting or continuing a round) sits dead center -- position 3
 * of 5, per MOBILE_TAB_ORDER above -- raised above the bar in a filled
 * gold circle so it reads as the obvious default tap without needing
 * color alone to say so; it's also physically larger (56px) and the
 * only tab that overlaps the bar itself. Every tab, Play included,
 * keeps its plain text label underneath so nothing here depends on
 * recognizing an icon. All five sit in equal flex-1 columns, so
 * centering Play is just a matter of its position in the list.
 */
export function MobileTabs() {
  const pathname = usePathname();
  const items = MOBILE_TAB_ORDER.map(
    (href) => NAV_ITEMS.find((item) => item.href === href)!,
  );

  // The Quick Round single-screen setup (spec: "hide the main bottom
  // navigation while Quick Round setup is open; show a clear Back or
  // Cancel action instead") replaces the tab bar with its own in-page
  // Cancel link and sticky "Start Scoring" button -- both would be
  // fighting the tab bar for the same strip of screen otherwise. Every
  // other route keeps the tab bar exactly as before.
  if (pathname?.startsWith("/play/quick")) {
    return null;
  }

  return (
    <nav
      aria-label="Primary"
      className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-forest-900/[0.08] bg-cream-50/95 backdrop-blur md:hidden"
    >
      <div className="mx-auto flex max-w-content items-end">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          if (item.href === "/play") {
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className="flex min-h-14 flex-1 flex-col items-center justify-end gap-1 pb-1.5"
              >
                <span
                  className={cn(
                    "-mt-6 flex h-14 w-14 items-center justify-center rounded-full shadow-card transition-colors",
                    active
                      ? "bg-gold-500 text-forest-950"
                      : "bg-gold-400 text-forest-950 active:bg-gold-500",
                  )}
                >
                  <item.icon className="h-6 w-6" aria-hidden="true" strokeWidth={2.25} />
                </span>
                <span
                  className={cn(
                    "text-[11px] font-semibold",
                    active ? "text-forest-900" : "text-charcoal-700",
                  )}
                >
                  {item.label}
                </span>
              </Link>
            );
          }
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 py-1.5 active:bg-forest-900/[0.04]",
                active ? "text-forest-900" : "text-charcoal-600",
              )}
            >
              <item.icon
                className="h-5 w-5"
                aria-hidden="true"
                strokeWidth={active ? 2.25 : 1.75}
              />
              <span className={cn("text-[11px]", active ? "font-semibold" : "font-medium")}>
                {item.label}
              </span>
              {active && (
                <span className="absolute top-0 h-0.5 w-8 rounded-full bg-forest-800" aria-hidden="true" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
