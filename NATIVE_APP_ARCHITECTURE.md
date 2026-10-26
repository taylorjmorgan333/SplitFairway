# Native app architecture report

Written after the web/PWA work (Phases 1–5) was implemented and tested,
per the production-readiness upgrade plan. This is a report only — no
`ios/` or `android/` native project exists yet, no bundle ID or package
name has been reserved with Apple or Google, and nothing here should be
read as "ready to submit." It's the groundwork for that decision.

## Can the app be bundled locally? No — and it shouldn't try to be.

SplitFairway is a Next.js App Router application that depends on
server-side execution for almost everything that matters:

- **Auth** is SSR cookie-based (`@supabase/ssr`'s `createServerClient`),
  refreshed on every request by `src/middleware.ts`. There is no
  client-only auth path.
- **Every mutation** (create/edit expense, report/confirm a payment,
  invite a golfer, delete a trip, delete an account) is a Next.js Server
  Action, which only runs on the server.
- **Authorization** is enforced by Postgres Row Level Security policies
  and `SECURITY DEFINER` RPC functions on the Supabase side, called from
  those server actions — the browser never gets a service-role key or
  direct table-mutation rights.
- **Route protection** (redirecting a signed-out visitor away from
  `/dashboard`, `/trips/*`, `/account`) happens in middleware, which only
  runs on the Vercel-hosted server.

None of that survives a static export (`next export` / `output: "export"`).
A statically bundled, offline-capable version of this app would mean
rewriting auth, every mutation, and every authorization check to run
entirely client-side against Supabase directly — a materially different
and less secure architecture, not a packaging change. **This app requires
a hosted backend (the existing Vercel deployment) at all times.** That's
consistent with Capacitor's "remote URL" mode, which is what
`capacitor.config.ts` (already added) uses: the native shell loads
`https://www.splitfairwaygolf.com` directly, so the deployed app is the
one and only source of truth — nothing to keep in sync between "the app"
and "the site."

## Which Next.js/server features require the hosted backend

- Server Actions (all mutations)
- Middleware (auth refresh + route protection)
- `SECURITY DEFINER` RPC calls that run authorization logic in Postgres
- Server Components that read data on render (every trip/dashboard page)
- Resend email sending (reminders, feedback notifications) — server-only
  env vars (`RESEND_API_KEY`, `FEEDBACK_TO_ADDRESS`) that must never ship
  to a client bundle

Nothing in the current codebase can move to the device. This is a
"thin native shell around a live web app," not a hybrid app with local
business logic.

## How Supabase auth works inside iOS/Android

In remote-URL mode, the WKWebView (iOS) / Chrome-based WebView (Android)
loads the real site, so **auth works exactly as it does in Safari or
Chrome today** — Supabase sets its session cookies against
`www.splitfairwaygolf.com`, middleware reads them, nothing device-specific
is required for login/signup/password reset to function. This was
already verified conceptually in the mobile/PWA phase (WKWebView shares
Safari's cookie store for the same origin) and applies the same way to a
Capacitor-wrapped app, since Capacitor's iOS WebView is also a WKWebView
instance.

Two things worth deciding deliberately before submission, not required
for a first working build:

- **Universal Links** (see below) so a magic-link / password-reset /
  invite email opens directly in the app instead of Safari when the app
  is installed.
- **Biometric re-entry** (Face ID/Touch ID) as a *device-local* unlock
  gate in front of an already-valid Supabase session — this is not a
  Supabase feature, it's a native convenience layer (see "native
  features" below).

## Required callback URLs

None need to change on the Supabase side for the remote-URL Capacitor
approach — the app isn't doing native OAuth (no "Sign in with Apple/
Google" button exists in the product today), so there's no
`myapp://callback`-style redirect URI to register in Supabase Auth
settings. If native OAuth sign-in is added later, that would need:

- A custom URL scheme (e.g. `com.splitfairway.app://auth-callback`) or a
  Universal Link registered as an additional **Redirect URL** in
  Supabase → Authentication → URL Configuration.
- Capacitor's `@capacitor/app` `appUrlOpen` listener to catch the
  redirect and hand the resulting session back to the web view.

Password reset and email-confirmation links already point at
`NEXT_PUBLIC_SITE_URL` (`https://www.splitfairwaygolf.com/...`) — those
work today inside the wrapped app exactly as they do in a browser tab, no
change required for a first build.

## Universal Links / Android App Links design

Needed so a trip invite or reminder link opens directly in the app
(when installed) instead of falling back to a normal browser tab.
Neither is set up yet; both require server-hosted verification files this
repo doesn't have:

- **iOS Universal Links**: publish `/.well-known/apple-app-site-association`
  (a JSON file, no extension, served with `Content-Type: application/json`)
  at the site root, listing the app's Team ID + bundle ID and the paths to
  hand to the app (`/trips/*`, `/invite/*`). Add the
  `com.apple.developer.associated-domains` entitlement
  (`applinks:www.splitfairwaygolf.com`) in Xcode. Requires the Apple
  Developer Team ID, which only exists once enrollment (already in
  progress separately) completes.
- **Android App Links**: publish
  `/.well-known/assetlinks.json` at the site root with the app's package
  name and the SHA-256 fingerprint of the signing certificate, and
  declare matching `<intent-filter android:autoVerify="true">` entries in
  the Android manifest for `/trips/*` and `/invite/*`.

Both files are static and can be added to `public/.well-known/` as soon
as the bundle ID/package name and signing identity are known — this is
a same-day task once those exist, not a redesign.

## Native navigation requirements

Because this is a remote-URL WebView, "native navigation" is really
about the chrome around the WebView, not a separate router:

- No native tab bar/stack navigator needed — the web app's own
  mobile-first navigation (bottom tab bar, trip tabs) already renders
  inside the WebView exactly as it does in mobile Safari/Chrome.
- **Android back button**: Capacitor's `@capacitor/app` plugin exposes a
  `backButton` event. Without handling it, Android's system back button
  either does nothing or exits the app instead of navigating the
  WebView's history. The correct behavior is: if `window.history` can go
  back within the WebView, do that; otherwise exit the app (or, on the
  dashboard/home screen specifically, treat back as exit rather than a
  dead end). This is a small, well-documented Capacitor pattern but
  isn't implemented yet since no native project exists.
- **iOS swipe-back gesture**: WKWebView supports edge-swipe-to-go-back
  automatically when `allowsBackForwardNavigationGestures` is enabled —
  a one-line native config, not a code change to the web app.

## How environment variables are provided securely

The native shell itself needs none of the app's environment variables —
`NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY`/etc. all live
on the Vercel deployment the WebView loads, exactly as they do for a
browser visitor. Nothing server-only (`SUPABASE_SERVICE_ROLE_KEY`,
`RESEND_API_KEY`, `FEEDBACK_TO_ADDRESS`) is ever bundled into the native
app, because none of it is bundled at all — there's no local JS bundle
holding secrets, since the app boots straight to the remote URL.

The one thing that does need care: **signing credentials**, not app
config — the Apple Distribution certificate/provisioning profile and the
Android signing keystore. Those belong in Xcode's/Android Studio's local
keychain and, for CI, a secrets manager (e.g. GitHub Actions encrypted
secrets via Fastlane `match` for iOS) — not committed to this repo.

## Native features needed to avoid a "bare website wrapper" rejection

Apple's App Store Review Guideline 4.2 ("Minimum Functionality") is the
real risk for a remote-URL wrapper: a WebView with nothing native beyond
loading a page reads as exactly the kind of submission Apple rejects.
Recommended for the **first** native build, in priority order:

1. **Deep links into trips and invitations** (Universal Links, above) —
   genuinely native behavior a plain bookmark can't do.
2. **Native share sheet** — replace the web `navigator.share`/copy-link
   fallback with Capacitor's `@capacitor/share` for inviting golfers, so
   sharing a trip invite uses iOS's real share sheet (Messages, Mail,
   etc.) instead of a web share polyfill.
3. **Native splash screen** (`@capacitor/splash-screen`) — already have
   the art (`native/ios-assets/splash-2732.png`) from the earlier PWA
   work; just needs wiring into the native project.
4. **Native status bar / keyboard handling** (`@capacitor/status-bar`,
   `@capacitor/keyboard`) — matching the theme color already used
   elsewhere and preventing the on-screen keyboard from covering form
   fields, which the web CSS work (16px inputs, safe-area padding) only
   partially addresses inside a native WebView.
5. **Push-notification architecture for reminders** — the single biggest
   piece of native-only value this app is missing today (reminders are
   currently email/copy-paste-text only). Proposed shape, not built yet:
   - `@capacitor/push-notifications` to register for an APNs/FCM device
     token on first launch (after a deliberate, contextual permission
     prompt — never on cold start).
   - A new Supabase table, `push_subscriptions` (user_id, device token,
     platform, created_at), RLS-scoped so a user can only see/delete
     their own rows.
   - A server-side sender (Supabase Edge Function or a Vercel cron route)
     that reuses the existing reminder-candidate logic in
     `src/lib/reminders.ts` and calls APNs/FCM instead of (or alongside)
     the existing email path.
   - `notificationclick` handling to deep-link into the specific trip.
   This is real, non-trivial backend work and is correctly scoped as its
   own follow-up, not a checkbox in the native wrapper.
6. **Biometric re-entry** (`capacitor-native-biometric` or similar) —
   Face ID/Touch ID as a local re-entry gate in front of an already-valid
   Supabase session (never a replacement for the session itself), useful
   given the app shows real financial balances. Reasonable to include in
   a first build since it's low-effort and directly relevant to a
   finance-adjacent app; not required for Apple's review, just a good
   trust signal.

**Explicitly deferred, not required for a first submission:**

- **Camera receipt capture** — no expense-photo-attachment feature
  exists in the product yet; adding native camera access ahead of that
  feature would be native capability with nothing behind it.
- **Full offline trip access** — the web PWA phase deliberately scoped
  offline support to a static "you're offline" fallback, not offline
  editing/sync (see README → "Mobile & PWA" → "Later phases" for the
  reasoning: it needs an outbox/conflict-resolution design against the
  authoritative balance-calculation module, not a native-wrapper
  checkbox).

## Proposed bundle ID / package name (not reserved)

- iOS bundle ID: `com.splitfairway.app` (already used as a placeholder
  in `capacitor.config.ts` — not yet registered in App Store Connect).
- Android package name: `com.splitfairway.app` (same reasoning — Android
  package names conventionally mirror the iOS bundle ID for a
  cross-platform app; not yet created in Google Play Console).

Both are proposals for you to approve, not reservations — nothing has
been registered with Apple or Google. Once approved, they're set once in
App Store Connect / Play Console and in `capacitor.config.ts`'s `appId`,
and shouldn't change after the first submission (changing either later
means shipping as a new app listing, not an update).

## Exact steps for Xcode / Android Studio / TestFlight / Play testing

**iOS (Xcode + TestFlight):**

1. `npm install` (pulls in `@capacitor/core`/`@capacitor/ios`/`@capacitor/cli`,
   already added to `package.json`).
2. `npx cap add ios` — generates the `ios/` Xcode project from
   `capacitor.config.ts`.
3. Add the app icon/launch screen from `native/ios-assets/` (see
   `native/README.md`, already written).
4. Open in Xcode (`npm run ios:open`), set the signing team under your
   Apple Developer account, confirm bundle ID.
5. Implement the recommended native features above (share sheet, status
   bar, splash screen, back-button-equivalent gesture config) as small,
   native-side additions — none require touching the web app.
6. Run on Simulator, then a real device via a USB/Wi-Fi debug connection
   (Xcode → Window → Devices and Simulators) — required at least once,
   since some things (Face ID, real push delivery) don't work in
   Simulator.
7. Product → Archive → Distribute App → App Store Connect.
8. In App Store Connect, add the build to a TestFlight group and invite
   testers by email (internal testers: instant; external testers: a
   quick Apple review, usually under a day) — this is the realistic way
   to get it on a real iPhone as "testing," before any public submission.
9. Once satisfied, create the App Store listing (screenshots, privacy
   nutrition label, description) and submit that same build for review.

**Android (Android Studio + Play Console internal testing):**

1. `npx cap add android` (not yet run — same `capacitor.config.ts`
   applies to both platforms).
2. Open in Android Studio, set the application ID, generate a signing
   keystore (Build → Generate Signed Bundle/APK) and **store it somewhere
   durable and backed up** — losing it means losing the ability to ship
   updates to the same app listing, permanently.
3. Add the adaptive icon (the maskable PWA icons already generated in
   `public/icons/icon-maskable-*.png` are directly reusable here) and
   splash screen.
4. Build a signed `.aab` (Android App Bundle).
5. In Google Play Console, create the app listing, upload the `.aab` to
   the **Internal testing** track first (near-instant, up to 100
   testers by email/link — no review wait), verify on a real Android
   device, then promote to **Closed** → **Open** testing or production
   once ready, each of which does go through Play's automated + policy
   review (usually hours, not days, for a straightforward app).

Both platforms need their respective native features (share sheet,
status bar, deep links) implemented once, in the native projects, before
this is more than a functional-but-minimal wrapper — worth doing before
the first real submission, not after a rejection.
