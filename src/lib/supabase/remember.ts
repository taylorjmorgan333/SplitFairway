import type { CookieOptions } from "@supabase/ssr";

/**
 * Name of the plain marker cookie that records whether a signed-in
 * user unchecked "Stay signed in" at login. Its ABSENCE means
 * "remembered" — the app's original behavior — so nobody who was
 * already logged in before this feature existed gets signed out by
 * it. It's only ever written with the value "0", and only as a
 * browser session cookie (see applyRememberPolicy below), so it
 * disappears the moment the auth cookies it's paired with do.
 */
export const REMEMBER_COOKIE_NAME = "sf-remember";

export function isRemembered(markerValue: string | undefined): boolean {
  return markerValue !== "0";
}

/**
 * @supabase/ssr's cookie adapter hard-codes every auth cookie it sets
 * to its own long default lifetime (~400 days) — it spreads
 * `options.cookieOptions` and then unconditionally overwrites
 * `maxAge` back to the default, so that override point can't be used
 * to shorten a session. The only place we can actually do it is here,
 * in our own `setAll` callback, by rewriting the options Supabase
 * handed us before they reach the real cookie store.
 *
 * When `remembered` is false, strips `maxAge`/`expires` from any
 * cookie Supabase is *setting* so the browser treats it as an
 * ordinary session cookie (cleared when the browser fully closes).
 * Cookie *removals* — which Supabase always sends with `maxAge: 0`,
 * e.g. on sign-out — are left untouched either way; `0` is falsy so
 * this never mistakes a deletion for a set.
 */
export function applyRememberPolicy(
  options: CookieOptions,
  remembered: boolean,
): CookieOptions {
  if (remembered || !options.maxAge) return options;
  const rest: CookieOptions = { ...options };
  delete rest.maxAge;
  delete rest.expires;
  return rest;
}
