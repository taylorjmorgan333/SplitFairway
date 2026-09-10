import { Capacitor, registerPlugin } from "@capacitor/core";

interface SessionCookieStorePlugin {
  save(options: { json: string }): Promise<void>;
  clear(): Promise<void>;
}

/**
 * Bridges to a small custom native plugin (see
 * ios/App/App/MainViewController.swift's SessionCookieStorePlugin) that
 * snapshots the Supabase auth cookies into UserDefaults, and re-seeds
 * the WKWebView's cookie jar with them the next time the app cold-
 * launches. See syncSessionCookiesToNative below for why this exists.
 * A no-op outside the native app -- every call site here checks
 * Capacitor.isNativePlatform() first.
 */
const SessionCookieStore = registerPlugin<SessionCookieStorePlugin>("SessionCookieStore");

const REMEMBER_COOKIE_NAME = "sf-remember";

function readCookies(): Array<{ name: string; value: string }> {
  if (typeof document === "undefined" || !document.cookie) return [];
  return document.cookie
    .split("; ")
    .filter(Boolean)
    .map((pair) => {
      const eq = pair.indexOf("=");
      return { name: pair.slice(0, eq), value: pair.slice(eq + 1) };
    });
}

/**
 * Absence of the marker cookie means "remembered" -- see
 * src/lib/supabase/remember.ts, the source of truth for this same
 * check on the server side.
 */
function isRemembered(cookies: Array<{ name: string; value: string }>): boolean {
  const marker = cookies.find((c) => c.name === REMEMBER_COOKIE_NAME);
  return marker?.value !== "0";
}

/**
 * Snapshots the current Supabase auth cookies (name starts with "sb-",
 * per @supabase/ssr's default cookie naming) into native storage, so
 * MainViewController can re-inject them into the WKWebView's cookie
 * jar before the app's first request goes out on the next cold
 * launch. This exists because WKWebView has a documented tendency to
 * drop even long-lived, non-expired first-party cookies specifically
 * around a full force-quit/relaunch cycle -- confirmed happening on
 * this app (four forced re-logins inside 40 minutes, all with valid
 * ~400-day session cookies) and independent of the 7-day iOS
 * auto-refresh cap fixed separately in src/lib/supabase/client.ts.
 * Reading document.cookie works here because these cookies are
 * httpOnly: false (see DEFAULT_COOKIE_OPTIONS in @supabase/ssr) --
 * that's what lets the browser Supabase client read them too.
 *
 * Deliberately skips this (and clears any previous snapshot) when the
 * user unchecked "Stay signed in": that choice means the session
 * should end when the browser/app session ends, and silently
 * resurrecting it after a force-quit would defeat the whole point of
 * the checkbox.
 */
export async function syncSessionCookiesToNative(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  const cookies = readCookies();

  if (!isRemembered(cookies)) {
    await clearNativeSessionCookies();
    return;
  }

  const sessionCookies = cookies.filter(({ name }) => name.startsWith("sb-"));
  if (sessionCookies.length === 0) return;

  try {
    await SessionCookieStore.save({ json: JSON.stringify(sessionCookies) });
  } catch {
    // Best-effort: this snapshot is only a fallback restore path, not
    // the source of truth for the session, so a failure here just
    // means the next cold launch falls back to a normal login.
  }
}

export async function clearNativeSessionCookies(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await SessionCookieStore.clear();
  } catch {
    // Best-effort, see above.
  }
}
