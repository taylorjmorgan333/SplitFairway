"use client";

import { useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { restoreSessionCookiesFromNative } from "@/lib/native-session-sync";
import { isSafeRelativePath } from "@/lib/utils";

const ATTEMPTED_KEY = "sf-native-restore-attempted";

/**
 * Wraps the /login page's actual content (see
 * src/app/(auth)/login/page.tsx). Landing here inside the native app
 * can mean the user genuinely signed out, but it can also mean
 * WKWebView lost its session cookie around a force-quit/relaunch
 * faster than the native, launch-time cookie injection could win the
 * race (see ios/App/App/MainViewController.swift's
 * restoreSessionCookies) -- that race can't be made 100% reliable
 * without deadlocking the main thread, so it isn't always won.
 *
 * The fallback is to retry the same restore here (now safely
 * awaitable, since a plugin call isn't on any synchronous return
 * path) and, on success, do a full reload -- that's what actually
 * sends the newly-set cookie to the server, letting middleware
 * recognize the session on the very next request.
 *
 * An earlier version tried to hide the form client-side, in a
 * useEffect, once a retry was about to start. That doesn't actually
 * work: the server has no way to know this is the native app, so its
 * response already contains the full, real login form -- WKWebView
 * paints that HTML the instant it arrives, well before any JS runs at
 * all, let alone a React effect after hydration. No client-side
 * timing trick can hide content that was already painted.
 *
 * The real fix has to start on the server: shouldAttemptRecovery is
 * computed in login/page.tsx from the request itself (a custom
 * User-Agent token the native app appends, plus middleware's `next`
 * param, present only when this visit is a bounce-off-a-protected-
 * route rather than a direct visit) and passed in as this component's
 * *initial* state -- so for the case worth hiding for, the server's
 * own HTML never includes the form to begin with. Nothing changes for
 * web visitors or a direct /login visit: shouldAttemptRecovery is
 * false there and children render immediately, exactly as always.
 *
 * Guarded by sessionStorage to attempt the retry only once per loaded
 * session: a genuinely expired/invalid session (e.g. the refresh
 * token itself was revoked) reveals the normal login form afterward
 * instead of reload-looping forever.
 */
export function NativeSessionRecovery({
  next,
  shouldAttemptRecovery,
  children,
}: {
  next?: string;
  shouldAttemptRecovery: boolean;
  children: React.ReactNode;
}) {
  const attempted = useRef(false);
  const [recovering, setRecovering] = useState(shouldAttemptRecovery);

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;

    if (!shouldAttemptRecovery) return;

    // Belt-and-suspenders: the server's guess (from the User-Agent
    // token) should always agree with this, but if it somehow doesn't,
    // don't leave the form hidden.
    if (!Capacitor.isNativePlatform()) {
      setRecovering(false);
      return;
    }
    if (sessionStorage.getItem(ATTEMPTED_KEY)) {
      setRecovering(false);
      return;
    }
    sessionStorage.setItem(ATTEMPTED_KEY, "1");

    void restoreSessionCookiesFromNative().then((restored) => {
      if (restored) {
        window.location.href = isSafeRelativePath(next) ? next : "/dashboard";
        return;
      }
      setRecovering(false);
    });
  }, [next, shouldAttemptRecovery]);

  if (recovering) {
    return (
      <div className="flex min-h-[280px] items-center justify-center">
        <div
          aria-hidden="true"
          className="h-6 w-6 animate-spin rounded-full border-2 border-forest-200 border-t-forest-700"
        />
        <span className="sr-only">Signing you back in&hellip;</span>
      </div>
    );
  }

  return <>{children}</>;
}
