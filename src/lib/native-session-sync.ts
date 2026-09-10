import { Capacitor, registerPlugin } from "@capacitor/core";

interface SessionCookieStorePlugin {
  save(options: { json: string }): Promise<void>;
  clear(): Promise<void>;
  // Diagnostic-only: routes a message to NSLog so it shows up in
  // Xcode's console without needing Safari's separate Web Inspector.
  // Temporary -- see the removal note near the bottom of this file.
  log(options: { message: string }): Promise<void>;
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

/**
 * TEMPORARY diagnostic helper. The first attempt at this feature
 * didn't survive a force-quit and there's no way to tell, from here,
 * which link in the chain broke: this logs to both the normal JS
 * console (visible via Safari's Web Inspector) and, via the plugin, to
 * NSLog (visible directly in Xcode's console while running from
 * Xcode) -- so a real device test tells us exactly where this stops
 * working. Remove this and the plugin's `log` method once the feature
 * is confirmed working.
 */
function diag(message: string): void {
  console.log(`[SessionCookieStore] ${message}`);
  if (Capacitor.isNativePlatform()) {
    void SessionCookieStore.log({ message }).catch(() => {});
  }
}

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
  diag(`sync start, isNativePlatform=${Capacitor.isNativePlatform()}`);
  if (!Capacitor.isNativePlatform()) return;

  const cookies = readCookies();
  diag(`read ${cookies.length} cookie(s): ${cookies.map((c) => c.name).join(", ") || "(none)"}`);

  if (!isRemembered(cookies)) {
    diag("not remembered (sf-remember=0) -- clearing native snapshot instead of saving");
    await clearNativeSessionCookies();
    return;
  }

  const sessionCookies = cookies.filter(({ name }) => name.startsWith("sb-"));
  diag(`${sessionCookies.length} sb- cookie(s) to snapshot`);
  if (sessionCookies.length === 0) return;

  try {
    await SessionCookieStore.save({ json: JSON.stringify(sessionCookies) });
    diag("save() resolved OK");
  } catch (err) {
    // Best-effort: this snapshot is only a fallback restore path, not
    // the source of truth for the session, so a failure here just
    // means the next cold launch falls back to a normal login.
    diag(`save() threw: ${String(err)}`);
  }
}

export async function clearNativeSessionCookies(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await SessionCookieStore.clear();
    diag("clear() resolved OK");
  } catch (err) {
    // Best-effort, see above.
    diag(`clear() threw: ${String(err)}`);
  }
}
