// SplitFairway service worker — deliberately minimal for this phase.
//
// Scope: this ONLY exists so the app is installable on Android (which
// requires a registered service worker with a fetch handler) and so a
// user who opens the installed app with no connection sees an on-brand
// "you're offline" message instead of a browser error page.
//
// It does NOT cache app pages, API responses, or expense/payment data,
// and it does NOT support offline editing or background sync — trip
// data always comes from the network. See README.md ("Later phases")
// for why that's a deliberate scope decision, not an oversight.

const CACHE_NAME = "splitfairway-offline-v1";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.add(OFFLINE_URL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  // Only intercept page navigations (e.g. opening the installed app, or
  // following a shared trip/invite link). Everything else — API calls,
  // images, scripts — passes straight through to the network with no
  // caching, so data is always fresh.
  if (event.request.mode !== "navigate") {
    return;
  }

  event.respondWith(fetch(event.request).catch(() => caches.match(OFFLINE_URL)));
});
