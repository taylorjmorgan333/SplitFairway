"use client";

import { LogOut, Settings } from "lucide-react";
import Link from "next/link";
import { signOutAction } from "@/actions/auth";
import { clearNativeSessionCookies } from "@/lib/native-session-sync";

export function UserMenu({ email }: { email: string }) {
  return (
    <div className="flex items-center gap-1">
      <Link
        href="/account"
        className="flex h-9 items-center gap-2 rounded-full px-3 text-sm text-charcoal-700 transition-colors hover:bg-forest-800/5"
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-forest-800 text-[11px] font-semibold text-cream-50">
          {email.charAt(0).toUpperCase()}
        </span>
        <span className="hidden max-w-[10rem] truncate sm:inline">{email}</span>
      </Link>
      <Link
        href="/account"
        aria-label="Account settings"
        className="hidden h-9 w-9 items-center justify-center rounded-full text-charcoal-500 transition-colors hover:bg-forest-800/5 hover:text-forest-800 sm:flex"
      >
        <Settings className="h-4 w-4" aria-hidden="true" />
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
      >
        <button
          type="submit"
          aria-label="Log out"
          className="flex h-9 w-9 items-center justify-center rounded-full text-charcoal-500 transition-colors hover:bg-forest-800/5 hover:text-forest-800"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
        </button>
      </form>
    </div>
  );
}
