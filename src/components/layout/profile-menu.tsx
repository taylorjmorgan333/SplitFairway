"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, LogOut, Settings, UserRound, Sparkles } from "lucide-react";
import { signOutAction } from "@/actions/auth";
import { clearNativeSessionCookies } from "@/lib/native-session-sync";
import { cn } from "@/lib/utils";

/**
 * Replaces the old header cluster of three separate controls (email
 * link, gear icon, sign-out button -- all three ultimately just links
 * to /account plus a bare logout button) with the single avatar/profile
 * menu pattern: one round button, one dropdown, four destinations.
 * "Account" here is the only place that link lives on desktop now --
 * DesktopNav drops its own "Account" tab so the two never duplicate
 * each other again. Follows the same click-outside-to-close pattern as
 * RoundOptionsMenu/RoundPhaseTabs' three-dot menu.
 */
export function ProfileMenu({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const initial = email.charAt(0).toUpperCase();

  useEffect(() => {
    if (!open) return;
    function onDocPointer(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocPointer);
    return () => document.removeEventListener("mousedown", onDocPointer);
  }, [open]);

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        className="flex h-11 items-center gap-2 rounded-full px-2 text-charcoal-700 transition-colors hover:bg-forest-800/5 sm:pr-3"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-forest-800 text-xs font-semibold text-cream-50">
          {initial}
        </span>
        <span className="hidden max-w-[9rem] truncate text-sm sm:inline">{email}</span>
        <ChevronDown className={cn("hidden h-4 w-4 text-charcoal-400 transition-transform sm:inline", open && "rotate-180")} aria-hidden="true" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-1 w-56 overflow-hidden rounded-lg border border-forest-900/10 bg-white shadow-lg"
        >
          <div className="border-b border-charcoal-400/10 px-4 py-2.5">
            <p className="truncate text-sm font-medium text-forest-900">{email}</p>
          </div>
          <Link
            href="/account"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex min-h-11 w-full items-center gap-2.5 px-4 py-2.5 text-left text-base text-forest-900 hover:bg-cream-100"
          >
            <UserRound className="h-4 w-4 text-charcoal-500" aria-hidden="true" />
            Account
          </Link>
          <Link
            href="/plans"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex min-h-11 w-full items-center gap-2.5 px-4 py-2.5 text-left text-base text-forest-900 hover:bg-cream-100"
          >
            <Sparkles className="h-4 w-4 text-charcoal-500" aria-hidden="true" />
            Plans
          </Link>
          <Link
            href="/account/settings"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex min-h-11 w-full items-center gap-2.5 px-4 py-2.5 text-left text-base text-forest-900 hover:bg-cream-100"
          >
            <Settings className="h-4 w-4 text-charcoal-500" aria-hidden="true" />
            Settings
          </Link>
          <form
            action={signOutAction}
            onSubmit={() => {
              // Fire-and-forget: don't hold up the actual sign-out for
              // this. Otherwise a stale native cookie snapshot (see
              // src/lib/native-session-sync.ts) would silently sign the
              // native app back in on its next cold launch.
              void clearNativeSessionCookies();
            }}
            className="border-t border-charcoal-400/10"
          >
            <button
              type="submit"
              role="menuitem"
              className="flex min-h-11 w-full items-center gap-2.5 px-4 py-2.5 text-left text-base text-charcoal-700 hover:bg-cream-100"
            >
              <LogOut className="h-4 w-4 text-charcoal-500" aria-hidden="true" />
              Sign Out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
