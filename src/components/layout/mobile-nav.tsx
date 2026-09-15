"use client";

import { useEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";
import { SectionLink } from "@/components/marketing/section-link";

/**
 * The public site's mobile nav menu -- follows the same click-outside-
 * to-close pattern as ProfileMenu (src/components/layout/profile-
 * menu.tsx) and RoundOptionsMenu's three-dot menu, so the interaction
 * feels consistent with the rest of the app even though this menu is
 * public-marketing-only. Kept as its own small client component so
 * SiteHeader itself stays a server component; only this toggle ships
 * client JS.
 */
export function MobileNav({ links }: { links: { href: string; label: string }[] }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocPointer(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocPointer);
    return () => document.removeEventListener("mousedown", onDocPointer);
  }, [open]);

  return (
    <div className="relative md:hidden" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Menu"
        className="flex h-11 w-11 items-center justify-center rounded-full text-forest-900 transition-colors hover:bg-forest-800/5"
      >
        {open ? (
          <X className="h-5 w-5" aria-hidden="true" />
        ) : (
          <Menu className="h-5 w-5" aria-hidden="true" />
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-2 w-56 overflow-hidden rounded-lg border border-forest-900/10 bg-white shadow-lg"
        >
          {links.map((link) => (
            <SectionLink
              key={link.href}
              href={link.href}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex min-h-11 items-center px-4 py-2.5 text-base text-forest-900 hover:bg-cream-100"
            >
              {link.label}
            </SectionLink>
          ))}
        </div>
      )}
    </div>
  );
}
