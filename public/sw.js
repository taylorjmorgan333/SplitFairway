// SplitFairway service worker — deliberately minimal for this phase.
//
// Scope: this ONLY exists so the app is installable on Android (which
// requires a registered service worker with a fetch handler) and so a
// user who opens the installed app with no connection sees an on-brand
// "you're offline" message instead of a browser error page.
//
// Explicitly, this worker:
//  - Never caches Supabase auth responses, API responses, trip/expense/
//    payment data, balances, or invitation tokens — the only thing ever
//    written to the Cache API is the static offline.html fallback page
//    (precached once in "install" below). Every other request, navigate
//    or not, goes straight to the network with nothing stored.
//  - Therefore can't leak one signed-in user's data to the next person
//    on a shared device: there is no cached authenticated HTML or API
//    response sitting around to serve back to whoever opens the app
//    next. Supabase's own session cookie (not this worker) is what
//    scopes a device to one signed-in user at a time.
//  - Takes over immediately on every deploy: skipWaiting() (below) plus
//    clients.claim() means a new worker version activates without
//    waiting for every open tab to close, and the app itself never has
//    stale page data to begin with since navigations are network-first.
//    Combined with updateViaCache: "none" at registration (see
//    service-worker-register.tsx), a deploy is picked up on next visit,
//    not silently stuck on an old version.
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
