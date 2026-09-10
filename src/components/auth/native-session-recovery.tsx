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
 * recognize the session on the very next request. This part runs
 * unconditionally on every native mount (via Capacitor.
 * isNativePlatform(), the real ground truth), regardless of what the
 * server guessed -- confirmed the hard way that gating the actual
 * recovery attempt on the server's guess is a real bug, not just a
 * missed optimization: a native build from before the User-Agent
 * token existed (see below) makes the server guess wrong, and if that
 * guess also gates whether recovery is *attempted*, a real, working
 * session gets thrown away instead of restored.
 *
 * shouldAttemptRecovery, computed in login/page.tsx from a custom
 * User-Agent token the native app appends plus middleware's `next`
 * param (present only when this visit is a bounce-off-a-protected-
 * route, not a direct visit), is used ONLY as this component's
 * *initial* render state -- purely a flash-avoidance optimization.
 * When the server guesses right, the real form is never in the HTML
 * WKWebView paints, so there's nothing to flash. When it guesses
 * wrong (e.g. a stale native build), the form may flash briefly
 * before the effect below hides it and the recovery still runs --
 * degraded, not broken. Nothing changes for web visitors or a direct
 * /login visit: shouldAttemptRecovery is false there and the form
 * renders immediately either way.
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

    // The real, ground-truth check -- independent of the server's
    // UA-based guess above. Always run this on native, whatever the
    // server assumed.
    if (!Capacitor.isNativePlatform()) {
      setRecovering(false);
      return;
    }
    if (sessionStorage.getItem(ATTEMPTED_KEY)) {
      setRecovering(false);
      return;
    }
    sessionStorage.setItem(ATTEMPTED_KEY, "1");

    // In case the server guessed wrong and the form is currently
    // visible (shouldAttemptRecovery was false): hide it now, even
    // though that's a frame or two later than ideal.
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
