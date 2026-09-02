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

This is the foundation: the design system, app shell, public landing
page, and the authenticated pages as working placeholders. Authentication
(sign up, log in, password reset) is wired to real Supabase Auth. The
**trips/expenses/payments database schema has not been built yet** — the
dashboard, create-trip, and trip-detail pages are intentionally
placeholders and say so on screen rather than pretending to show real
data.

## Tech stack

- [Next.js](https://nextjs.org/) (App Router) + TypeScript
- [Tailwind CSS](https://tailwindcss.com/) for styling
- [Supabase](https://supabase.com/) for authentication (Postgres + storage
  planned for a later pass)
- [Zod](https://zod.dev/) for input validation
- Server Actions for mutations (sign up, log in, password reset)
- Deployable to [Vercel](https://vercel.com/)

## Getting started

### Prerequisites

- Node.js 20 or later
- A free [Supabase](https://supabase.com/) project (for authentication)

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

`SUPABASE_SERVICE_ROLE_KEY` is not currently used by the app, but is
reserved for future server-only routes. It must never be imported into
any file that ships to the browser, and never prefixed with
`NEXT_PUBLIC_`.

In your Supabase project, add `${NEXT_PUBLIC_SITE_URL}/auth/callback` to
**Authentication → URL Configuration → Redirect URLs** so sign-up
confirmation and password-reset emails redirect back into the app
correctly.

### 3. Run the dev server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000).

### 4. Build, lint, and type-check

```bash
npm run build
npm run lint
npm run typecheck
```

## Project structure

```
src/
  actions/           Server Actions (auth mutations)
  app/
    (auth)/           Sign up, log in, forgot/reset password
    (app)/             Authenticated pages (dashboard, trips, account)
    auth/callback/     Supabase email-link redirect handler
    page.tsx           Public landing page
  components/
    ui/                Base design-system components (Button, Card, Input, ...)
    layout/            Site header/footer, authenticated app shell
    marketing/         Landing-page sections
    auth/              Auth form components
    dashboard/         Dashboard placeholders (empty state, stat cards)
  lib/
    supabase/          Browser, server, and middleware Supabase clients
    validation/        Zod schemas
  middleware.ts        Refreshes the Supabase session, gates protected routes
```

## Design system

- **Colors**: dark forest green (primary), warm off-white (background),
  muted gold (accent, used sparingly), warm charcoal (text). Defined as a
  full Tailwind color scale in `tailwind.config.ts`.
- **Type**: a serif for headings, a system sans-serif for body text — no
  external font requests, so builds don't depend on network access to a
  font CDN.
- **Components**: hand-built, accessible-by-default (visible focus rings,
  `aria-invalid`/`aria-describedby` wiring on form fields, semantic
  landmarks) rather than a third-party component kit, to keep the
  foundation dependency-light.

## Security notes

- The Supabase **service role key** is never sent to the browser and is
  not currently used anywhere in application code.
- All mutating auth flows run through Server Actions with Zod validation
  on the server, not just the client.
- `middleware.ts` refreshes the Supabase session on every request and
  redirects signed-out visitors away from `/dashboard`, `/trips`, and
  `/account`.

## What's next

- Design and build the trips/expenses/payments/participants schema in
  Supabase (Postgres + Row Level Security).
- Wire the dashboard, create-trip, and trip-detail pages to real data.
- Payment recording (Venmo/Zelle/PayPal/cash/check) and reminder emails.
- A software subscription via Stripe (billing for the app only — never a
  cut of trip money).
