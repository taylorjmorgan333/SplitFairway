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
 * Earlier versions of this let the login form render normally while
 * that retry happened in the background, which meant fully showing
 * "you're logged out" (a real, interactive password field included)
 * for the whole round trip before yanking the user away to their
 * dashboard -- confusing and, fairly, looked broken rather than like
 * a deliberate recovery. This instead hides the form the instant a
 * retry is going to be attempted (before that retry even starts, not
 * after it resolves), so what's briefly visible is a plain loading
 * state, not the form -- and nothing at all changes for web visitors
 * or for a native visitor with no snapshot to try, since Capacitor.
 * isNativePlatform() is false/there's nothing to retry and children
 * render immediately in both cases.
 *
 * Guarded by sessionStorage to attempt this only once per loaded
 * session: a genuinely expired/invalid session (e.g. the refresh
 * token itself was revoked) shows the normal login form afterward
 * instead of reload-looping forever.
 */
export function NativeSessionRecovery({
  next,
  children,
}: {
  next?: string;
  children: React.ReactNode;
}) {
  const attempted = useRef(false);
  const [recovering, setRecovering] = useState(false);

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;

    if (!Capacitor.isNativePlatform()) return;
    if (sessionStorage.getItem(ATTEMPTED_KEY)) return;
    sessionStorage.setItem(ATTEMPTED_KEY, "1");

    // Hide the form *before* starting the (necessarily async) retry,
    // not after -- otherwise the form sits there fully visible and
    // interactive for the whole round trip, which is the confusing
    // part this is meant to fix.
    setRecovering(true);

    void restoreSessionCookiesFromNative().then((restored) => {
      if (restored) {
        window.location.href = isSafeRelativePath(next) ? next : "/dashboard";
        return;
      }
      setRecovering(false);
    });
  }, [next]);

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
