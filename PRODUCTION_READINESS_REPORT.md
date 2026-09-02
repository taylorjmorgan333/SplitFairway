# Production readiness upgrade — status report

Covers the Phase 1–6 production-readiness request. Every item below is graded honestly against
five levels: **(1) implemented locally, (2) verified in a production build, (3) deployed,
(4) verified on the live production domain, (5) still requires a human** (a real device, a store
account, an attorney, or a monitored mailbox). Nothing is marked done unless it actually is.

## Current state, confirmed live on splitfairwaygolf.com right now

Before touching anything, I re-checked the live site. Production is currently serving commit
`08bb536` ("Update homepage headline to new slogan") — **none of this work, including the earlier
mobile-PWA pass, has been deployed yet.** Confirmed live right now:

- `/contact` shows `support@golftriptreasurer.example`, explicitly labeled "Placeholder address
  for this beta — replace with a real monitored inbox before launch."
- The homepage pricing section shows Annual Organizer at "$—/year" with the same clickable
  "Create Your Trip" button as the free plan.
- `/robots.txt` and `/sitemap.xml` both 404.
- Homepage `<title>` is just "SplitFairway" with no OG/Twitter image tags.

This matches the problems the request described. All eight commits below fix them, but **your
production domain still shows the old, broken state until you deploy.**

## What's committed, on your Mac, ready to push

Your local `golf-trip-treasurer` repo (on this Mac, `main` branch) is 8 commits ahead of
`origin/main`. Nothing has been pushed — I don't have push credentials for your GitHub repo from
this environment, and deliberately didn't try to work around that. **You need to run `git push`
yourself** from a real Terminal on this Mac; Vercel's GitHub integration will then build and
deploy to production automatically.

Commits, oldest first:

1. `2e3ac12` — Add installable PWA support and mobile-first redesign *(from the earlier mobile
   session, was sitting uncommitted until now)*
2. `3a5ac18` — Prepare Capacitor iOS wrapper for App Store submission *(ditto)*
3. `b91abd8` — **Phase 1**: support email config, pricing fix, SEO/OG metadata, robots.txt/sitemap.xml
4. `d53be60` — **Phase 2**: PWA manifest `id` field, service worker cache-safety documentation + update handling
5. `63b9371` — **Phase 3**: self-serve account deletion (server action, migration, UI, updated legal page)
6. `44d2a4f` — **Phase 5**: feedback-submission disclosure copy
7. `89c062c` — **Phase 6**: native app architecture report (`NATIVE_APP_ARCHITECTURE.md`)
8. `f792d46` — **Phase 4**: mobile-experience audit + one real bug fix (payment form didn't clear after success)

## Phase-by-phase status

### Phase 1 — critical public-launch fixes
- Support email centralized behind `NEXT_PUBLIC_SUPPORT_EMAIL`. **You have not given me a real
  monitored mailbox**, so I didn't invent one — the contact and data-deletion pages will show a
  visible red "support email not configured" notice, and the production build logs a warning,
  until you set that env var in Vercel. **This is the one item that blocks a clean public launch
  and only you can close it.**
  - Full repo search for `golftriptreasurer`, `.example`, `placeholder`, `TODO`, `FIXME`: zero
    remaining customer-facing occurrences outside the two legal pages, which intentionally still
    say "(Draft)" — Phase 3 covers why those stay honest rather than being marked final.
- Annual Organizer no longer has a live signup button — it's a non-interactive "Coming later"
  card; the free plan is the primary, available option.
- Full SEO metadata added (canonical URLs, metadataBase, OG/Twitter tags, exact homepage
  title/description, a branded 1200×630 social image built from your approved crest, not redrawn).
- `/robots.txt` and `/sitemap.xml` implemented as Next.js native routes. Sitemap only lists public
  pages; robots disallows everything behind auth or carrying an invite token.
- Status: (1) done, (2)/(3)/(4) blocked on your `git push` + setting `NEXT_PUBLIC_SUPPORT_EMAIL`
  in Vercel.

### Phase 2 — installable mobile web app
- Manifest now includes the required `id` field. Service worker's caching behavior was already
  safe (only caches the static offline page — never Supabase auth/API/trip data) from the earlier
  session; I added explicit documentation of that guarantee plus `updateViaCache: "none"` and a
  visibility-triggered update check so deploys don't strand people on a stale cached version.
- Status: (1) done, (2)/(3)/(4) blocked on push.

### Phase 3 — account deletion
- **The database migration (`delete_own_account()`) is already live in your production Supabase
  project** — I applied it directly and verified the grants (`anon` cannot call it,
  `authenticated` can). This is the one piece of Phase 3 that's already at level (4).
- The application code (Settings screen, server action, confirmation page, rewritten public
  deletion policy page) is committed but not deployed — level (1) only until you push.
- Deletion policy, in one place: deletes your profile/login outright; hard-deletes any trip where
  you're the only active member; on a shared trip, anonymizes your name/email but keeps your
  expenses/payments so other golfers' balances stay correct, and auto-promotes the
  longest-tenured member to captain if you were the only one; hard-deletes your feedback/analytics
  rows. Runs entirely as you, the authenticated user — no service-role key involved, consistent
  with how every other privileged action in this app works.
- Privacy Policy and Terms of Service pages still say "(Draft)" — correctly, since neither has
  been reviewed by an attorney. I did not relabel them as final. **Level (5): needs your lawyer.**

### Phase 4 — mobile product experience
- Re-audited against the specific checklist (touch targets, no tables/horizontal scroll,
  loading/empty/error/success states, one-thumb reach, back-button behavior, invite deep links,
  numeric keyboards) rather than re-doing the earlier mobile pass. Full findings: no tables
  anywhere in the codebase, every list is a responsive card layout; touch targets are 44px+ on
  mobile; every priority flow has distinct loading/empty/error/success states; amount fields use
  `inputMode="decimal"`; invitation links correctly resolve to the specific trip/token and carry
  a `next` param back through login/signup to the same invitation.
- One real gap found: there is no modal/dialog system anywhere in this app (confirmations use
  native `window.confirm()`), so there's genuinely nothing yet to wire to Android back-button
  handling — that's not a bug to fix now, it's a fact recorded in `NATIVE_APP_ARCHITECTURE.md` for
  whenever a native overlay UI gets built.
- One real bug found and fixed: the payment-report form didn't clear its fields after a successful
  submission, so it looked like it hadn't submitted even though the success message was showing.
- Status: (1) done, (2)/(3)/(4) blocked on push.

### Phase 5 — feedback and support
- Confirmed the feedback button is already hidden on every public/unauthenticated page (homepage,
  legal, auth, invite) and only appears once signed in — so the contact page's "once you're signed
  in" copy already matched actual behavior; no inconsistency needed fixing there.
- Confirmed the server action rejects unauthenticated submissions, and that the automatically
  attached context is only the current page's path (no query string, so no invite tokens leak).
- Added an inline disclosure in the feedback panel telling people exactly what's attached
  automatically and that nothing else about their trip is sent unless they type it.
- Status: (1) done, (2)/(3)/(4) blocked on push.

### Phase 6 — native app architecture
- `NATIVE_APP_ARCHITECTURE.md` written: why local bundling isn't possible, how Supabase auth
  works unchanged in a Capacitor WebView, Universal Link/App Link requirements, the Android
  back-button gap noted above, a ranked feature list, a proposed (not reserved) bundle ID, and
  exact TestFlight/Play Console steps. No iOS/Android project was created — as instructed, that's
  still gated on your Apple Developer enrollment finishing.
- Status: (1) done — this phase is documentation only, nothing to deploy.

## Quality assurance — what I could and couldn't actually run

Both environments available to me this session (this cloud sandbox, and the shell bridged to your
Mac) have **no outbound access to the npm package registry** — every `npm install` attempt returns
a 403, in both places, for every package including totally unrelated ones. That's a hard
network-policy boundary, not something I tried to work around. Practical effect:

| Check | Result |
|---|---|
| `tsc --noEmit` | **Ran, clean.** One pre-existing, expected error on `capacitor.config.ts` (missing `@capacitor/core` types) — that's because Capacitor was never `npm install`ed on this Mac yet; documented in `native/README.md` as a step for you to run yourself. Zero errors anywhere else. |
| `next lint` | **Ran, clean.** Zero warnings or errors. The support-email build warning fires exactly as designed. |
| `vitest run` (automated tests) | **Could not run.** Missing native `@rollup/rollup-linux-arm64-gnu` binary in the bridged shell, and no registry access to install it anywhere. **You'll need to run `npm test` yourself** before or right after pushing. |
| `next build` (production build) | **Could not run**, same reason. Vercel's own build servers don't share this restriction — pushing to GitHub will get you a real, clean build on infrastructure that isn't network-limited the way this session is. |
| Push to GitHub / trigger a Vercel deploy | **Could not do this myself** — this session's git access is read-only for your repo. **You'll need to run `git push`.** |
| Live production domain, post-deploy | **Not yet checked** — nothing's deployed yet. Once you push, I'm happy to re-verify robots.txt, sitemap.xml, the metadata, the pricing card, and the deletion flow against the real live domain. |

I did re-verify the *current* (pre-deploy) live site against the specific problems this task
described (see "Current state" above) so the fixes are grounded in what's actually broken, not
assumptions.

## What you need to do, in order

1. **Set `NEXT_PUBLIC_SUPPORT_EMAIL`** in Vercel's production environment variables to a real,
   monitored mailbox. Nothing else in Phase 1 can look finished without this.
2. In a real Terminal on this Mac: `cd` into the project, run `npm install`, then `npm test` and
   `npm run build` — confirm both are clean before pushing (I couldn't run either from here).
3. `git push` — this deploys everything above to production automatically via Vercel's GitHub
   integration.
4. Tell me once it's live and I'll re-verify robots.txt, sitemap.xml, social-sharing previews, the
   pricing card, and a full account-deletion dry run against the real production domain.
5. Privacy Policy / Terms of Service still need actual attorney review before either can honestly
   say "final."
6. App Store submission (Apple Developer enrollment, Xcode, Capacitor `ios` project) is unrelated
   to this deploy and still waiting on you, per the earlier conversation.
