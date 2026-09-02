"use client";

import { useEffect } from "react";

/**
 * Registers the minimal offline-fallback service worker (see
 * public/sw.js). Safe to render unconditionally — silently does nothing
 * on browsers without SW support, and any registration failure is
 * swallowed so it can never break page load.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Non-fatal: the app works fully online without a service worker,
      // it just won't show the on-brand offline page or be installable
      // on Android.
    });
  }, []);

  return null;
}
