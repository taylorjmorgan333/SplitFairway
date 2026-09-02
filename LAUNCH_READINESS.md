# Golf Trip Treasurer — Private Beta Launch Readiness Report

Generated 2026-09-02. Covers the full beta-readiness pass: onboarding, mobile quality, trust/clarity copy, reliability/security hardening, the dev-only demo seed, and documentation.

## Automated verification

| Check | Result |
|---|---|
| TypeScript (`tsc --noEmit`) | **Clean** — run on your machine via the linked device bridge |
| Lint (`next lint`) | **Clean**, 0 warnings/errors |
| Supabase security advisor | No issues beyond the intentional `SECURITY DEFINER` design (see below) |
| Supabase performance advisor | Only informational notices (unindexed FKs on 2 new low-traffic tables, unused indexes — expected on brand-new tables with no query history yet) |
| `npm install` (to pick up the new `tsx` dev dependency) | **Passed** — confirmed by you, run on your machine |
| Test suite (`npm test` / Vitest) | **Passed** — confirmed by you, run on your machine |
| Production build (`npm run build`) | **Passed** — confirmed by you, run on your machine |

All checks are green. `npm install`, `npm test`, and `npm run build` couldn't be run from the device bridge's shell (no registry access, missing native build/test binaries), so you ran them directly and confirmed nothing failed.

## Completed this pass

**Onboarding.** A dismissible 6-step checklist (create account → create trip → add golfers → add expense → review balances → share invite link) on the trip overview, visible to captains, backed by real trip data where possible and a lightweight local flag for "reviewed balances." Empty states across the dashboard, expense list, and payments list now include a worked example instead of just a blank message — no fake data is seeded into real accounts.

**Mobile quality.** Fixed iOS Safari's auto-zoom-on-focus by forcing 16px form-control font size below 640px. Added `overflow-x: hidden` globally to stop horizontal scroll from long content. Balance cards and list rows now wrap and truncate correctly for long golfer names and large dollar amounts (`flex-wrap`, `min-w-0`, `shrink-0`, `tabular-nums`) instead of overlapping or overflowing. Darkened the `charcoal-400` text color from a 3.9:1 to a ~4.7:1 contrast ratio against its background, clearing WCAG AA for the small secondary/timestamp text that token is used for everywhere. Added a proper `viewport` export (deliberately without `maximumScale`/`userScalable=no`, so low-vision users can still pinch-zoom).

**Trust and clarity.** Four required disclosures ("we don't book travel," "we don't hold or transfer group funds," "payment records should be confirmed by the appropriate person," "trip captains are responsible for verifying reservations and balances") now appear in both the public marketing footer and a new footer in the authenticated app shell — previously the app shell had no footer at all, so logged-in users never saw this copy. Added draft Privacy Policy, Terms of Service, Contact, and Data Deletion Request pages, each behind a shared `LegalPageShell` that renders a prominent "Draft — not final, not attorney-reviewed" banner. The Terms page explicitly states the four trust points as legal-style language, not just marketing copy.

**Quality and reliability.** Added an authenticated-app error boundary and a root-level `global-error.tsx` as a last resort, both logging only `error.digest`/`error.message` (never raw error objects or user data). Added a friendly generic `/unauthorized` page — note that trip-specific access failures deliberately stay 404 rather than 403, so as not to leak trip existence through the response code. Added skeleton loading states for the dashboard and trip pages. Fixed a real duplicate-submission bug in the trip danger zone: the "Delete trip" button was reading pending state from the archive toggle's transition, not its own, so double-clicking delete wasn't actually prevented — it now has its own `useFormStatus` guard. Added an `activity_log` audit trail entry for trip updates and archive/restore, alongside the existing entries for expenses, payments, and membership changes.

**Security.** Reviewed every RLS policy in the schema. Found and fixed a real gap: Supabase's default schema privileges had granted the `anon` role full table-level SELECT/INSERT/UPDATE/DELETE on every table, independent of RLS. In practice this was not exploitable — every existing policy is already scoped `to authenticated`, so anon was blocked at the RLS layer regardless — but it's now closed explicitly with a `revoke all ... from anon` migration across all 8 tables, as defense-in-depth matching this codebase's existing over-cautious grant style for functions. The `SECURITY DEFINER` warnings the Supabase advisor still reports (about 20 of them) are all intentional: this app's entire authorization model is these functions internally re-checking captain/member membership before mutating anything, which is the documented, correct pattern for this kind of RPC-gated access — not a gap. Confirmed no secrets are committed to the repo (only `.env.example` is tracked; `.env*.local` is gitignored) and no hardcoded API keys or JWT-shaped strings exist anywhere in source. Removed a console log that printed a user's email address and message text unconditionally (the dev-mode email preview) — it's now gated to non-production environments only. Checked all 9 `package.json` dependencies for actual usage; none are unused. Confirmed every sensitive mutation (trip creation, expense/payment changes, invitations, ownership transfer) already runs through server-only Supabase RPCs, never client-side.

**Analytics and feedback.** Added a minimal first-party `analytics_events` table — insert-only, no third-party script, no cookies, no IP/device fingerprinting, not even a select policy for users to read their own rows back — wired into 6 key funnel actions (trip created, expense created, golfer invited, payment reported/confirmed, invite accepted). Added a floating feedback button for beta users, rate-limited to 10 submissions/hour, saved to a `beta_feedback` table and optionally emailed to a configured address.

**Demo seed.** `scripts/seed-demo.ts` (`npm run seed:demo`) builds one trip with 8 golfers (including one deliberately long name for UI testing), lodging with a custom room-cost split, 4 golf rounds (one past-due), a rental vehicle, a mix of confirmed and outstanding payments, and one golfer who never reports their payment (the overdue fixture). It's guarded three independent ways — an explicit `ALLOW_DEMO_SEED=true` opt-in, a `NODE_ENV !== "production"` check, and a localhost-only `NEXT_PUBLIC_SITE_URL` check — and architecturally it only uses the service-role key to create the fake auth accounts, then drives every actual data mutation through the same RPCs and RLS the real app uses, so it can never bypass authorization for trip data the way a raw insert could.

**Documentation.** README now covers full local setup, Supabase setup, migrations, environment variables (including the two new ones), test commands, Vercel deployment steps (with an explicit warning never to set the service-role key or demo-seed flag there), a private-beta checklist, and a known-limitations section.

## Remaining risks

With install, tests, and the production build all confirmed green, the automated side of this pass is complete. What's left is process and content, not code:

Account deletion is a manual, email-driven process, not self-serve — acceptable for a small private beta but worth setting expectations with early users. There's no automated end-to-end/browser test coverage, only unit tests for the calculation-heavy logic (splits, balances, reminders). Analytics and feedback have no dashboard — both are just Supabase tables, so someone needs to check them via the Supabase dashboard or SQL periodically. The app supports a single currency per trip with no conversion. The legal pages are explicitly drafts and must go through an actual attorney before this stops being a beta.

## Manual steps you need to perform

Set `FEEDBACK_TO_ADDRESS` (and `RESEND_API_KEY`/`EMAIL_FROM_ADDRESS` if you want it to actually send) if you want beta feedback emailed to you; otherwise it's still saved to the database either way. Set `NEXT_PUBLIC_SUPPORT_EMAIL` to a real monitored inbox before beta users see the Contact and data-deletion pages — until it's set, those pages show a visible "not configured" notice instead of a fake address. When you deploy to Vercel, set the environment variables from `.env.example` there — but deliberately leave `SUPABASE_SERVICE_ROLE_KEY` and `ALLOW_DEMO_SEED` unset in Vercel; they should only ever exist in your local `.env.local`. Get the Privacy Policy and Terms of Service reviewed by an actual attorney before treating this as a real beta rather than a private test. Decide who's checking `beta_feedback` and `analytics_events` periodically, since neither has a dashboard yet.
