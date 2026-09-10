"use client";

import { useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { restoreSessionCookiesFromNative } from "@/lib/native-session-sync";
import { isSafeRelativePath } from "@/lib/utils";

const ATTEMPTED_KEY = "sf-native-restore-attempted";

/**
 * Mounted on the /login page (see src/app/(auth)/login/page.tsx).
 * Landing here inside the native app can mean the user genuinely
 * signed out, but it can also mean WKWebView lost its session cookie
 * around a force-quit/relaunch faster than the native, launch-time
 * cookie injection could win the race (see
 * ios/App/App/MainViewController.swift's restoreSessionCookies) --
 * that race can't be made 100% reliable without deadlocking the main
 * thread, so it isn't always won.
 *
 * This is the fallback: if a native session snapshot still exists,
 * retry the same restore here (now safely awaitable, since a plugin
 * call isn't on any synchronous return path) and, if it succeeds, do
 * a full reload -- that's what actually sends the newly-set cookie to
 * the server, letting middleware recognize the session on the very
 * next request. When it works, this page flashes for a moment rather
 * than making the user log in again.
 *
 * Guarded by sessionStorage to attempt this only once per loaded
 * session: a genuinely expired/invalid session (e.g. the refresh
 * token itself was revoked) would otherwise reload-loop back to
 * /login forever instead of just showing the normal login form.
 */
export function NativeSessionRecovery({ next }: { next?: string }) {
  const attempted = useRef(false);

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;

    if (!Capacitor.isNativePlatform()) return;
    if (sessionStorage.getItem(ATTEMPTED_KEY)) return;
    sessionStorage.setItem(ATTEMPTED_KEY, "1");

    void restoreSessionCookiesFromNative().then((restored) => {
      if (!restored) return;
      window.location.href = isSafeRelativePath(next) ? next : "/dashboard";
    });
  }, [next]);

  return null;
}
