"use client";

import { useEffect } from "react";
import { syncSessionCookiesToNative } from "@/lib/native-session-sync";

// How often to refresh the native snapshot while the app stays open
// and foregrounded without a background/resume cycle -- those cycles
// (via the visibilitychange/focus listeners below) already trigger a
// sync, this is just a backstop so a long uninterrupted session (e.g.
// the live leaderboard left open) doesn't drift too far from whatever
// cookie value the middleware's periodic refresh most recently wrote.
const SYNC_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Mounted once in the root layout (see ServiceWorkerRegister for the
 * same pattern). Entirely a no-op outside the native iOS app --
 * Capacitor.isNativePlatform() is false in Mobile Safari or any
 * desktop/mobile browser, so this changes nothing about how the site
 * itself behaves. Inside the app, keeps a native-storage fallback copy
 * of the current session cookies so MainViewController.swift can
 * restore them if WKWebView drops its own copy around a force-quit.
 */
export function NativeSessionSync() {
  useEffect(() => {
    void syncSessionCookiesToNative();

    const onVisible = () => {
      if (document.visibilityState === "visible") void syncSessionCookiesToNative();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    const interval = window.setInterval(() => void syncSessionCookiesToNative(), SYNC_INTERVAL_MS);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      window.clearInterval(interval);
    };
  }, []);

  return null;
}
