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
    navigator.serviceWorker
      .register("/sw.js", {
        // Always re-fetch sw.js itself from the network rather than the
        // HTTP cache, so a deployed change to the worker is picked up on
        // the next visit instead of possibly being served stale for up
        // to a day (the default browser heuristic-cache lifetime for a
        // same-URL script). Combined with skipWaiting()/clients.claim()
        // in sw.js, this is what keeps someone from getting stuck on an
        // old version of the app after a deploy.
        updateViaCache: "none",
      })
      .then((registration) => {
        // A tab left open for a long time (or backgrounded, on mobile)
        // won't otherwise re-check for a new worker until its next
        // navigation — this nudges that check on visibility regain, since
        // trip data is fetched live on every page anyway and there's
        // nothing else here that would make an update disruptive.
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") {
            registration.update().catch(() => {});
          }
        });
      })
      .catch(() => {
        // Non-fatal: the app works fully online without a service worker,
        // it just won't show the on-brand offline page or be installable
        // on Android.
      });
  }, []);

  return null;
}
