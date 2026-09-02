# Golf Trip Treasurer

Golf Trip Treasurer helps golf-trip organizers calculate group expenses,
divide costs fairly, track payments, send reminders, and stop chasing
friends for money.

**This version is payment tracking software only.** It does not hold,
route, or process money between golfers. Payments made through Venmo,
Zelle, PayPal, cash, check, or any other outside method are recorded here,
not moved here. Stripe may be added later, but only to charge for the
software subscription itself — never as a way to move money between
golfers.

## Current status

Design system, app shell, public landing page, and authentication (sign
up, log in, password reset) are all wired to real Supabase Auth. The
**database foundation is built**: the full trips/expenses/payments/
invitations schema, Row Level Security on every table, and captain-only
authorization enforced on the server. The app has also gone through a
**private-beta readiness pass** — see "Private beta readiness" below for
what that covers (onboarding, mobile polish, legal/trust pages,
observability, and a demo seed).

The trip page is a full **expense, balance, invitation, and reminder
system**, organized into tabs:

- **Overview** — total trip cost, amount paid/confirmed, amount
  outstanding, the next payment deadline, active golfer count, every
  golfer's balance card, and a recent-activity feed.
- **Golfers** — the roster (filterable by invited/active/declined/
  removed), co-treasurer promotion/demotion, the full invitation
  lifecycle (invite, copy link, resend, revoke), and — for the trip's
  owner — transferring primary trip ownership.
- **Expenses** — add, edit, and delete expenses. A captain splits an
  expense evenly across everyone active, evenly across a chosen subset,
  or with a custom dollar amount per golfer. Editing an expense fully
  recalculates its shares; deleting one removes its shares in the same
  transaction.
- **Payments** — report a payment made outside the app, with a required
  recipient; the trip's captain **or that payment's designated
  recipient** confirms or rejects it.
- **Reminders** (captain-only) — a reminder center covering overdue
  members, payments due in the next seven days, reported payments
  awaiting confirmation, and invitation reminders, each with three tones
  (Friendly / Direct / Funny), a copyable text message, and a "send
  email" button.
- **Activity** — a full, append-only log of everything that's happened
  on the trip.
- **Settings** — trip details and the danger zone (archive/delete),
  captain-only.

The Overview tab's **"Who owes what?"** panel shows every golfer's net
position and a suggested minimum set of reimbursements to settle up —
see "The balance formula" below for exactly how those numbers are
computed. It only ever suggests; it never creates a payment on anyone's
behalf.

### Co-treasurer support

A trip can have more than one **captain** at a time — there's no
"treasurer" vs. "co-treasurer" role distinction in the schema, just the
existing `captain` role with no cap on how many members can hold it. A
captain can promote any other active member to captain (equal authority:
editing trip details, inviting golfers, confirming payments, deleting the
trip) from the trip page, and demote them back — except a trip can never
be left with zero active captains, which a database trigger enforces
regardless of which client or API call is used.

### Trip ownership

Separately from the co-treasurer system, every trip has exactly one
**owner** (`trips.owner_id`) — a single, transferable, purely
administrative designation that starts as the creating captain. Owning a
trip does **not** grant any extra day-to-day permission a captain doesn't
already have; the only thing it controls is who can transfer that
designation onward. The owner transfers ownership from the Golfers tab by
picking the new owner and typing `TRANSFER` to confirm — the server
independently re-checks that the caller really is the current owner no
matter what the client sends. Transferring ownership to someone who isn't
already a captain automatically promotes them.

### Invitations

A captain adds a golfer by name and email from the Golfers tab, which
generates a single-use invitation link (shown once, right after
creation — the raw token is never stored, only its hash, so this is the
only chance to copy it). From there a captain can resend it (which
immediately invalidates the previous link and issues a fresh one),
revoke it, or watch its status move through invited → active / declined
/ removed.

The invited golfer opens `/invite/[token]` — a public page that shows
just enough to decide whether to join (trip name, destination, dates, an
estimated per-golfer cost, and the captain's name), lets them sign up or
log in (carrying them right back to the invite via a same-site-only
`?next=` redirect), and then accept or decline. Accepting joins them to
the correct trip automatically; the invitation token cannot be reused
once it's been accepted, declined, or revoked, and it expires after 14
days.

### External payment tracking

Golf Trip Treasurer never processes or holds money. A golfer reports a
payment (amount, recipient, method — Venmo / Zelle / PayPal / cash /
check / other, date, and an optional note or confirmation reference) and
it starts out **"Awaiting confirmation."** Only the trip's captain or
that specific payment's designated recipient can confirm or reject it,
and only a **confirmed** payment ever moves a balance. Every step —
report, confirm, reject — is written to the trip's activity log. Every
payment form carries the same explanatory copy: *"Golf Trip Treasurer
tracks payments but does not transfer funds. Complete the payment using
the trip captain's instructions, then record it here."*

## Private beta readiness

This pass focused on reliability, mobile usability, onboarding, trust
copy, and launch mechanics rather than new product features.

- **Onboarding** — a dismissible 6-step checklist (create account →
  create trip → add golfers → add first expense → review balances →
  share the invite link) appears on the trip Overview tab for captains,
  driven entirely by real trip data (`src/components/trips/
  onboarding-checklist.tsx`); it's never backed by fake seeded data.
  Empty states across expenses, payments, and the dashboard now include
  a short worked example, not just "nothing here yet."
- **Mobile quality** — a real `viewport` export, 16px form controls
  below 640px width (prevents iOS Safari's auto-zoom-on-focus), a
  global `overflow-x: hidden` guard so no single wide element can push
  the page sideways, `flex-wrap`/`min-w-0`/`tabular-nums` fixes on the
  balance cards so a long name and a large dollar amount never collide,
  and a darkened `charcoal-400` token (see "Accessibility" below).
  Every list (expenses, payments, golfers) already rendered as
  flex/`<li>` rows rather than literal `<table>` markup, so there was no
  classic table-overflow problem to fix.
- **Trust & clarity** — a footer notice (marketing site) and an
  authenticated-app footer both state plainly, everywhere: no travel
  booking, no fund custody, payment records only count once the right
  person confirms them, and captains stay responsible for verifying
  reservations and balances. Draft **Privacy Policy**, **Terms of
  Service**, **Contact**, and **Data deletion request** pages live under
  `/legal/*` and `/contact`, each labeled a draft that needs attorney
  review before anything is relied on as a real policy.
- **Quality & observability** — `error.tsx`/`global-error.tsx` error
  boundaries, a friendly `/unauthorized` page (trip access itself still
  intentionally 404s rather than 403s — see "Security model"),
  `loading.tsx` skeletons for the dashboard and trip pages, a
  `beta_feedback` table + in-app feedback button, first-party
  `analytics_events` (no third-party script, no cookies, no IP/device
  fingerprinting — see `src/lib/analytics.ts`), and activity-log entries
  for trip settings edits/archiving alongside the financial events that
  were already logged.
- **Demo seed** — `npm run seed:demo` populates a realistic sample trip
  (8 golfers, a custom-split lodging expense, four golf rounds, a
  rental van, a mix of confirmed/outstanding/overdue payments) for
  local development only; see "Demo seed" below for the safety guards
  that keep it out of production.

## Tech stack

- [Next.js](https://nextjs.org/) (App Router) + TypeScript
- [Tailwind CSS](https://tailwindcss.com/) for styling
- [Supabase](https://supabase.com/) for authentication and Postgres
  (database + Row Level Security)
- [Zod](https://zod.dev/) for input validation
- Server Actions for all mutations, backed by Postgres RLS policies and
  `SECURITY DEFINER` RPC functions for anything with cross-row
  authorization logic
- Deployable to [Vercel](https://vercel.com/)

## Getting started

### Prerequisites

- Node.js 20 or later
- A free [Supabase](https://supabase.com/) project

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy the example file and fill in your own Supabase project values:

```bash
cp .env.example .env.local
```

| Variable | Where to find it | Exposed to browser? |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase dashboard → Project Settings → API | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase dashboard → Project Settings → API (anon/public key) | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase dashboard → Project Settings → API (service role key) | **No — server only** |
| `NEXT_PUBLIC_SITE_URL` | The URL this app is running at (e.g. `http://localhost:3000`) | Yes |
| `RESEND_API_KEY` | [Resend](https://resend.com/) dashboard → API Keys — **optional** | **No — server only** |
| `EMAIL_FROM_ADDRESS` | A verified sending address/domain in Resend, e.g. `Golf Trip Treasurer <reminders@yourdomain.com>` — **optional** | **No — server only** |
| `FEEDBACK_TO_ADDRESS` | Where the in-app feedback button forwards a copy of each submission (also requires the two Resend vars above) — **optional** | **No — server only** |
| `ALLOW_DEMO_SEED` | Must be `true` to run `npm run seed:demo` — **local development only, never set in a real deployment** | **No — read only by `scripts/seed-demo.ts`, never by the running app** |

`SUPABASE_SERVICE_ROLE_KEY` is not read by the running app at all — the
only thing in this repo that uses it is `scripts/seed-demo.ts`, a
local-dev-only script (see "Demo seed" below). It must never be
imported into any file that ships to the browser, never prefixed with
`NEXT_PUBLIC_`, and never set in a deployed environment's env vars
unless something server-only genuinely needs it later.

`RESEND_API_KEY` and `EMAIL_FROM_ADDRESS` are both optional and both
server-only (see `src/lib/email/provider.ts`). Set **both** to send real
reminder emails through [Resend](https://resend.com/)'s REST API; leave
either unset and the app falls back to a safe development-mode provider
that logs a full preview of the email to the server console and reports
`delivered: false` — it never pretends a message went out when it
didn't. Either way, every reminder also gets copyable text-message-style
text in the UI, so reminders are usable even with no email provider
configured at all.

In your Supabase project, add `${NEXT_PUBLIC_SITE_URL}/auth/callback` to
**Authentication → URL Configuration → Redirect URLs** so sign-up
confirmation and password-reset emails redirect back into the app
correctly.

### 3. Set up the database

The schema lives in `supabase/migrations/` as plain, numbered SQL files —
there's no ORM. Apply them to your own Supabase project with the
[Supabase CLI](https://supabase.com/docs/guides/cli):

```bash
supabase link --project-ref your-project-ref
supabase db push
```

Or paste each file's contents into the Supabase dashboard's SQL editor,
in filename order, if you'd rather not install the CLI. Every future
schema change should be a new file in `supabase/migrations/` (never edit
an already-applied one) so the history stays a reliable, replayable
record.

**Auth trigger:** `handle_new_user()` (in
`20260902023932_functions_and_triggers.sql`) creates a matching
`public.profiles` row automatically whenever someone signs up — nothing
else to configure for that.

### 4. Verify Row Level Security actually works

`supabase/tests/rls_verification.sql` is a self-contained, self-cleaning
script — not a migration — that creates three throwaway accounts and
proves, against your real database and real RLS policies:

- an unauthenticated caller can't call `create_trip` or
  `create_expense_with_shares` at all;
- a captain can create a trip, invite a member, add an expense (via
  `create_expense_with_shares`, with the shares landing correctly split
  across golfers), and confirm a payment;
- a split whose per-golfer amounts don't add up to the expense total is
  rejected;
- an invited member can see the trip but can't add expenses (neither a
  direct table insert nor the RPC), delete the trip, or confirm payments
  (including a direct table `UPDATE`, not just the RPC);
- a captain can promote that member to a second, equal captain (the
  co-treasurer flow), who can then invite golfers, confirm payments, and
  delete the trip themselves;
- the trip can never be left with zero active captains;
- a user who was never invited sees none of the trip's rows;
- a non-captain can't call `update_expense_with_shares`, and can't
  directly `UPDATE` or `DELETE` an expense either; a captain can edit an
  expense and its shares are fully recalculated (old ones replaced) to
  match the new split; an edit whose shares don't sum to the new total
  is rejected;
- once a member is removed from the trip, they can't be referenced in a
  new or edited split;
- deleting an expense removes its `expense_shares` in the same
  transaction — no orphaned shares survive;
- `create_trip()` sets `owner_id` to the creating captain;
- an invitation token that's already been accepted cannot be accepted a
  second time — reuse is rejected, not just discouraged;
- an expired invitation, and a revoked one, cannot be accepted (and
  revoking marks the pending golfer's row `removed`);
- a non-captain member can't resend or revoke an invitation;
- `resend_trip_invitation()` invalidates the previous token — the old
  copied link stops working the instant a new one exists;
- a captain who is **not** the trip's current owner can't transfer
  ownership (captain authority alone isn't enough); the actual owner
  can, and it auto-promotes the new owner to captain;
- a payment's designated recipient — even a non-captain — can confirm
  or reject it; a member who is neither the captain nor that specific
  payment's recipient can't;
- `invite_trip_member()` is rate-limited rather than allowing unbounded
  invitations.

Run it any time you change a policy or RPC:

```bash
supabase db execute --file supabase/tests/rls_verification.sql
```

It either raises `ALL RLS/AUTHORIZATION CHECKS PASSED` or an exception
naming exactly which check failed. It's safe to run against a live
database — it only ever touches the rows it creates itself.

### 5. (Optional) Seed sample data for local development

```bash
# 1. Sign up two real accounts through the running app (npm run dev -> /signup)
# 2. Edit the two placeholder emails at the top of the seed file
# 3. Run it:
supabase db execute --file supabase/seed/seed.sql
```

This does **not** create fake auth users or bypass authorization — it
drives the same `create_trip`/`invite_trip_member` RPCs the app itself
calls, impersonating the two real accounts you signed up, and produces
one sample trip with two expenses so the dashboard has something to show.

### 5b. (Optional) Richer demo seed — 8 golfers, four rounds, a van, and an overdue payment

For a fuller demo than the two-expense seed above, `scripts/seed-demo.ts`
creates 8 real (but fake) demo golfer accounts and one trip with lodging
(a custom per-room split), four golf rounds, a rental van, several
confirmed and outstanding payments, and one deliberately overdue share —
enough to see every screen populated at once.

```bash
ALLOW_DEMO_SEED=true npm run seed:demo
```

This is **development-only** and guarded in three independent ways —
see the comment at the top of `scripts/seed-demo.ts` for the exact
checks — and it is never invoked by `npm run build`, a migration, a
deploy step, or anything else automatic. It uses
`SUPABASE_SERVICE_ROLE_KEY` to create the 8 demo accounts, but every
trip/expense/payment mutation after that goes through the same RPCs and
RLS policies a real signed-in user would hit — it cannot write anything
the app's own authorization rules wouldn't otherwise allow. The script
prints all 8 demo logins (and the shared, clearly-fake password) when
it finishes; re-running it is safe and reuses the same accounts rather
than duplicating them.

**Never run this against a shared, staging, or production database.**

### 6. Run the dev server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000).

### 7. Run the tests, lint, and type-check

```bash
npm test          # Vitest — the split/balance/settlement math
npm run lint
npm run typecheck
npm run build
```

`npm test` runs `src/lib/split.test.ts`, `src/lib/balances.test.ts`, and
`src/lib/reminders.test.ts` — pure unit tests for the split math, the
balance formula, the settlement-suggestion algorithm (equal splits with
and without a remainder, selected-member splits, valid/invalid custom
splits, confirmed-vs-reported payments, the worked settlement example,
and zero-balance/fully-settled trips), and the reminder message builder
(every reminder kind × every tone produces distinct, fact-correct copy,
and the "funny" tone is checked against a list of insulting words so it
can never regress into being mean). The database-authorization side of
the same requirements (unauthorized expense edits/deletes, editing
safely recalculating shares, deleting safely removing shares, a removed
member being excluded from new splits, reused/expired/revoked/
unauthorized invitations, ownership-transfer authorization, and
recipient-vs-unauthorized payment confirmation) is covered by
`supabase/tests/rls_verification.sql` instead, step 4 above — that's a
live-database check, not something a browser-side unit test can prove.

## Project structure

```
src/
  actions/           Server Actions (auth, trips, trip members, invitations,
                     expenses, payments, reminders, feedback)
  app/
    (auth)/           Sign up, log in, forgot/reset password
    (app)/             Authenticated pages (dashboard, trips, account)
                        — dashboard/ and trips/[tripId]/ each have a
                        loading.tsx skeleton; (app)/error.tsx is the
                        error boundary for everything under this group
    auth/callback/     Supabase email-link redirect handler
    invite/[token]/    Public invitation landing page (accept/decline)
    legal/             Draft Privacy Policy, Terms of Service, and Data
                        deletion pages — explicitly labeled drafts
    contact/           Contact page (email + points to the feedback button)
    unauthorized/      Generic "you don't have access to that" page
    global-error.tsx   Last-resort boundary for an error in the root layout
    page.tsx           Public landing page
  components/
    ui/                Base design-system components (Button, Card, Input, ...)
    layout/            Site header/footer, authenticated app shell (which
                        now includes a trust-notice footer), feedback button
    marketing/         Landing-page sections
    auth/              Auth form components
    dashboard/         Real dashboard widgets (stat cards, trip cards)
    invitations/       Accept/decline UI for the public invite page
    legal/             LegalPageShell — the shared "draft, not reviewed"
                        banner wrapper for the /legal/* pages
    trips/             Tab shell, expense/payment/member/invite forms and
                        lists, balance cards, settlement view, activity
                        feed, reminder center, onboarding checklist
  lib/
    split.ts           Pure split math (equal/selected/custom, remainder
                        distribution) — split.test.ts covers it
    balances.ts         The one authoritative balance + settlement module —
                        balances.test.ts covers it
    reminders.ts        Pure reminder-message builder (3 tones × 4 kinds) —
                        reminders.test.ts covers it
    invitations.ts      Shared TypeScript type for the invitation-preview
                        RPC's response shape
    onboarding.ts        Per-browser localStorage helpers for the
                        onboarding checklist's dismiss/click state
    analytics.ts         trackEvent() — first-party, no-third-party-script
                        product analytics (see "Security model")
    email/provider.ts   Email provider interface: Resend (real) or a safe
                        dev-log fallback that never claims delivery
    supabase/          Browser, server, and middleware Supabase clients,
                        plus the generated database.types.ts
    validation/        Zod schemas
  middleware.ts        Refreshes the Supabase session, gates protected routes
scripts/
  seed-demo.ts          Development-only demo seed (see "Demo seed" above) —
                        never run automatically, never usable in production
supabase/
  migrations/          Numbered, committed SQL migrations (the schema)
  tests/               rls_verification.sql — proves authorization boundaries
  seed/                seed.sql — safe, RPC-driven sample data for local dev
vitest.config.ts        Vitest config for the src/lib unit tests
```

## Data model

- **profiles** — one row per authenticated user, created automatically by
  `handle_new_user()`.
- **trips** — top-level trip; `created_by` is informational only, it does
  not grant any special access beyond being the first captain.
  `owner_id` is the single, transferable ownership designation — see
  "Trip ownership" above.
- **trip_members** — the roster: `role` (`captain` | `member`) and
  `status` (`invited` | `active` | `declined` | `removed`). A trip can
  have any number of active captains at once — this is what powers the
  co-treasurer feature.
- **trip_invitations** — hashed (never plaintext), expiring invitation
  tokens, with an explicit `status` (`pending` | `accepted` | `declined`
  | `revoked`) so resend/revoke never has to be inferred from
  `accepted_at`/`expires_at` alone; accepted or declined via RPC.
- **expenses** / **expense_shares** — an expense and how it's split across
  members, in integer cents.
- **payments** — a golfer reports a payment they made outside the app
  (Venmo, Zelle, PayPal, cash, check), naming a required recipient; the
  captain or that recipient confirms or rejects it. Nothing here moves
  money — it only records what golfers tell each other happened.
- **activity_log** — append-only audit trail, visible to all trip
  members. Every invitation, ownership-transfer, reminder, and trip
  settings/archive action is recorded here too, alongside every
  financial event, and it doubles as the ledger the rate limiter reads
  from (see "Security model" below).
- **beta_feedback** — free-text feedback submitted through the in-app
  Feedback button. Insert-and-select-your-own-rows only; there's no
  cross-user read policy, and no update/delete (append-only, same
  convention as activity_log).
- **analytics_events** — first-party product-usage events (trip
  created, expense added, invite sent/accepted, payment
  reported/confirmed). Insert-your-own-only, no select policy at all
  from the app's own API — it's reviewed via the Supabase dashboard,
  not surfaced back through the app. See "Security model" for what it
  deliberately does not collect.

All currency columns are integer cents (`*_amount_cents`, `*_cents`) —
never floating point. All timestamps are `timestamptz`.

## The balance formula

Every screen that shows what a golfer owes — the trip Overview, the
Golfers tab, the "Who owes what?" settlement view, even the cross-trip
numbers on the dashboard — gets its numbers from one function,
`calculateBalances()` in `src/lib/balances.ts`. Nothing recomputes this
math anywhere else, so the numbers can't drift between screens.

In plain terms, for each golfer:

1. **Total trip share** — add up their `expense_shares` across every
   expense on the trip. This is what they're on the hook for.
2. **Amount personally paid toward expenses** — add up the total of
   every expense where they're recorded as the one who paid the vendor
   (fronted the cost out of pocket).
3. **Confirmed reimbursements sent / received** — add up payments
   where they're the payer or the recipient, counting **only
   `confirmed` payments**. A payment someone merely *reported* hasn't
   been verified by a captain yet, so it can't move anyone's balance —
   that's the whole point of the confirm step.
4. **Net position** = (amount paid toward expenses − total trip share)
   + confirmed reimbursements sent − confirmed reimbursements received.
   Fronting more than your own share, or sending a confirmed
   reimbursement, both move your net position up (you're owed more, or
   you owe less). Receiving a confirmed reimbursement moves it back
   down.
5. **Amount owed** is whatever's left of a negative net position;
   **amount due back** is whatever's left of a positive one. Exactly
   one of the two is nonzero at a time (or both are zero — settled up).
6. **Upcoming due amount** — the slice of their total share that
   belongs to expenses with a due date that hasn't passed yet. It's a
   heads-up, independent of whether that share has already been
   settled.

**"Who owes what?"** is a separate step on top of the same numbers:
sort everyone with a positive net position (owed money) and everyone
with a negative one (owes money), then greedily match the person owed
the most against the person owing the most, settle the smaller of the
two amounts between them, and repeat. That always produces the fewest
possible suggested transfers — e.g. if Taylor is owed $800, Mike owes
$500, and Chris owes $300, it suggests exactly two payments (Mike →
Taylor $500, Chris → Taylor $300) instead of everyone paying everyone
else a little. It's display-only: no payment record is ever created
automatically. A golfer still reports the payment themselves once
they've actually sent it, and a captain still confirms it, exactly like
any other payment.

## Security model

- **Supabase Auth** issues the session; `middleware.ts` refreshes it on
  every request and redirects signed-out visitors away from `/dashboard`,
  `/trips`, and `/account`.
- **Row Level Security is enabled on every table** that holds user data.
  Membership checks run through `is_trip_member()` /
  `is_trip_captain()` — `SECURITY DEFINER` functions — rather than having
  each policy re-query `trip_members` directly, which avoids RLS
  recursion and keeps the logic in one place.
- **Captain-only actions** (edit trip settings, invite members, promote
  or remove members, add/edit/delete an expense, confirm/reject
  payments, delete the trip) are enforced by the database itself — via
  RLS `USING`/`WITH CHECK` clauses on direct table writes, or inside
  `SECURITY DEFINER` RPCs for anything that touches more than one row's
  worth of authorization logic. `create_expense_with_shares()` and
  `update_expense_with_shares()` are the clearest examples: each checks
  the caller is a captain, validates every golfer in the split is an
  active trip member (a removed or declined member can't be referenced,
  even by an edit), and rejects the whole call if the per-golfer shares
  don't add up to the total — all inside one atomic transaction, so an
  expense is never left half-updated. Deleting an expense relies on the
  `expense_shares` foreign key's `ON DELETE CASCADE`, so a single DELETE
  statement (itself atomic) removes the expense and every one of its
  shares together or not at all. The UI hides buttons a non-captain
  shouldn't see, but that's a convenience, not the security boundary —
  a non-captain calling the same Server Action or hitting the same RPC
  directly is rejected by the database either way (proven in
  `rls_verification.sql`, including a direct-table UPDATE/DELETE
  attempt on an expense, not just the RPC path).
- **Invitation tokens** are generated with `pgcrypto`
  (`gen_random_bytes`, 256 bits), hashed with SHA-256 before being
  stored (only the hash is ever persisted — the raw token is returned
  exactly once, at creation or resend, and never again), and expire
  after 14 days. Accepting and declining are single atomic
  check-and-set `UPDATE`s (`status = 'pending' AND expires_at > now()`),
  so a token can never be consumed twice even under a race (e.g. a
  double-click or two open tabs) — there's no separate SELECT-then-write
  window for a second request to sneak into. `get_invitation_preview()`
  — the RPC behind the public `/invite/[token]` page — is deliberately
  graduated: an unrecognized token reveals nothing but "not found," and
  a revoked/declined/expired one reveals only the trip's name; full
  trip/cost/captain details are only ever returned for a still-pending,
  actionable invitation.
- **Ownership transfer** re-checks server-side that the caller really is
  the trip's current owner, regardless of what the client sends — the
  typed `TRANSFER` confirmation in the UI is a deliberate speed bump for
  the person doing it, not the security boundary.
- **Recipient-confirmed payments**: `confirm_payment()`/
  `reject_payment()` authorize either the trip's captain or the specific
  payment's designated recipient — a member who is neither is rejected,
  even if they're an active golfer on the trip.
- **Rate limiting**: invitation and reminder actions (`invite_trip_member`,
  `resend_trip_invitation`, `log_reminder_sent`) each cap how many times
  a captain can call them per trip per hour, checked server-side inside
  the RPC itself — reusing `activity_log`, which every one of these RPCs
  already writes to on success, as the count source rather than adding a
  new table.
- **The Supabase service role key** is never sent to the browser and is
  not used anywhere in application code that runs for real traffic —
  the only thing that reads it is the local-only `scripts/seed-demo.ts`
  (see "Demo seed").
- **Table-level grants, as a second layer behind RLS**: Supabase's
  default schema privileges grant `anon` (and `authenticated`) broad
  table-level access — `SELECT`/`INSERT`/`UPDATE`/`DELETE` — on every
  new table in `public`. On every table in this project, Row Level
  Security is enabled with policies scoped `to authenticated` only, so
  an anonymous request already got zero rows and zero affected writes
  before this was ever addressed — RLS was always the real boundary.
  The `revoke_anon_table_grants` migration removes anon's table-level
  grant outright anyway, on every table, so an anonymous request is
  blocked at the grant level before RLS even has to run — not merely
  because every current policy happens to be scoped correctly. Every
  new table since (`beta_feedback`, `analytics_events`) revokes anon's
  grant explicitly as it's created, and each migration self-verifies
  this with `has_table_privilege()` asserts, the same pattern already
  used for function `EXECUTE` grants.
- **`SECURITY DEFINER` linter warnings are expected, not gaps.** Every
  RPC in this schema is intentionally `SECURITY DEFINER` so it can
  perform its own cross-row authorization checks (`is_trip_captain()`,
  recipient-vs-payment matching, etc.) — Supabase's security advisor
  flags all of them as "callable by X role," which is true and
  intentional; each function's own internal checks are the actual
  boundary. The two the advisor flags as anon-callable
  (`decline_trip_invitation`, `get_invitation_preview`) are
  deliberately anon-accessible, since a public invite link has to work
  for someone who hasn't signed up yet.
- **Analytics collects the minimum on purpose.** `analytics_events`
  (see "Data model") never records an IP address, user agent, device
  fingerprint, or any cross-site identifier — just "this signed-in user
  did this named thing," with a small caller-controlled JSON payload.
  There's no third-party analytics script on any page.
- **All mutating flows** run through Server Actions with Zod validation
  on the server, not just the client. A `?next=` redirect after
  login/signup (used to return an invited golfer to their invite link)
  is validated as a same-site relative path server-side — never followed
  if it points off-site.

## Deploying to Vercel

1. Push this repo to GitHub (or GitLab/Bitbucket) and
   [import it into Vercel](https://vercel.com/new) — the default
   Next.js build settings work as-is (`npm run build`, no config
   changes needed).
2. In the Vercel project's **Settings → Environment Variables**, add
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and
   `NEXT_PUBLIC_SITE_URL` (set this to the real deployed URL, e.g.
   `https://your-app.vercel.app` or a custom domain — **not**
   `localhost`) for the Production environment. Add `RESEND_API_KEY` /
   `EMAIL_FROM_ADDRESS` / `FEEDBACK_TO_ADDRESS` too if you want real
   emails to send. **Do not set `SUPABASE_SERVICE_ROLE_KEY` or
   `ALLOW_DEMO_SEED` in Vercel at all** — neither is needed by the
   running app, and leaving them unset is one more layer keeping the
   demo seed script from ever touching a real deployment.
3. In Supabase, add your deployed URL's `/auth/callback` path to
   **Authentication → URL Configuration → Redirect URLs** (e.g.
   `https://your-app.vercel.app/auth/callback`) — sign-up confirmation
   and password-reset links won't return to the app correctly without
   this.
4. Apply migrations to whichever Supabase project the deployment
   points at (`supabase db push`, or paste each file into the SQL
   editor in filename order — see "Set up the database" above). Run
   `supabase/tests/rls_verification.sql` against that project once
   before going live.
5. Deploy. Vercel rebuilds automatically on every push to the
   connected branch; there's no separate migration-deploy step to wire
   up beyond applying migrations to Supabase directly (step 4).
6. Preview deployments get their own URL per pull request — if you
   want auth redirects to work correctly on those too, either add a
   wildcard redirect URL pattern in Supabase (if your plan supports
   it) or accept that auth email links on preview deployments will
   land on production/localhost instead. This is a known limitation,
   not a bug — see below.

## Private-beta checklist

Use this before inviting real beta testers:

- [ ] Migrations applied to the Supabase project this deployment
      points at, and `supabase/tests/rls_verification.sql` passes
      against it (step 4 of "Getting started").
- [ ] `npm test`, `npm run lint`, `npm run typecheck`, and `npm run
      build` all pass locally on the exact commit being deployed.
- [ ] `NEXT_PUBLIC_SITE_URL` in the deployment's env vars matches the
      real deployed URL, and that URL's `/auth/callback` is registered
      in Supabase's redirect URL allowlist.
- [ ] `SUPABASE_SERVICE_ROLE_KEY` and `ALLOW_DEMO_SEED` are **not** set
      anywhere in the deployed environment.
- [ ] Real Supabase project (not a shared/local dev one) with fresh
      auth — no demo-seed accounts or test data left in it.
- [ ] `RESEND_API_KEY`/`EMAIL_FROM_ADDRESS` set and the sending domain
      verified in Resend, if you want reminder/feedback emails to
      actually deliver rather than log a dev preview.
- [ ] The four legal/trust pages (`/legal/privacy`, `/legal/terms`,
      `/legal/data-deletion`, `/contact`) have been reviewed by someone
      qualified to review them — they are explicitly labeled drafts in
      this repo and are **not** attorney-reviewed. Replace the
      placeholder support email address in `src/app/contact/page.tsx`
      and `src/app/legal/data-deletion/page.tsx` with a real, monitored
      inbox before real users see them if that review hasn't happened yet.
- [ ] Confirm who's actually monitoring `beta_feedback` (Supabase
      dashboard → Table Editor, or set `FEEDBACK_TO_ADDRESS`) and the
      support inbox on the Contact page — feedback that's never read
      defeats the purpose of the beta.
- [ ] Decide on and communicate the beta's data-retention story — see
      "Known limitations" below for what account/data deletion
      currently does and doesn't cover.
- [ ] Smoke-test the full first-use flow once, end to end, on both a
      real iPhone-sized and Android-sized screen: sign up → create a
      trip → invite a golfer → accept the invite as them → add an
      expense → report and confirm a payment.

## Known limitations

Honest gaps, not hidden ones — worth knowing before/during the beta:

- **Account deletion is manual.** There's no self-serve "delete my
  account" button; `/legal/data-deletion` documents an email-based
  process the team carries out by hand. Fine for a small private beta,
  not fine at any real scale.
- **No automated end-to-end/browser tests.** `npm test` covers pure
  logic (split math, balance math, reminder copy) and
  `rls_verification.sql` covers database authorization live — neither
  clicks through the actual UI. A real regression in, say, the invite
  page's rendering wouldn't be caught by either.
- **Analytics and feedback have no dashboard.** Both `analytics_events`
  and `beta_feedback` are plain Supabase tables with no built-in
  reporting UI — reviewing them means querying Supabase directly (or
  wiring up `FEEDBACK_TO_ADDRESS` for feedback specifically).
- **Auth preview-deployment redirects.** See step 6 of "Deploying to
  Vercel" — email confirmation/reset links on a PR preview URL will
  not round-trip correctly unless you've set up a wildcard Supabase
  redirect URL.
- **Single currency.** Every trip is USD; `trips.currency` exists in
  the schema but nothing in the UI lets it be anything else yet.
- **No push notifications.** Reminders are email (or copy-paste text)
  only — there's no mobile push or SMS sending, just SMS-ready copy
  text the captain sends manually.
- **The legal pages are drafts.** Said elsewhere in this README too,
  but worth repeating here: Privacy Policy, Terms of Service, and the
  data-deletion page are placeholder text for a beta, not
  attorney-reviewed documents.

## What's next

- A software subscription via Stripe (billing for the app only — never a
  cut of trip money).
- Self-serve account deletion.
- Automated end-to-end browser tests alongside the existing unit and
  RLS test suites.
