import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Supabase client for use in Client Components. Uses the public anon
 * key only — safe to call from the browser. Never import the service
 * role key here or anywhere that ships to the client bundle.
 *
 * `autoRefreshToken` is off: this client's default persistence writes
 * the refreshed session via `document.cookie`, and Safari/WebKit's
 * Intelligent Tracking Prevention silently caps any cookie set that
 * way at 7 days, no matter what maxAge is requested -- overriding the
 * long-lived session the server sets and forcing a re-login roughly
 * every week, especially inside the iOS app's WKWebView. The session
 * is instead kept fresh by the server: middleware.ts refreshes it via
 * a real Set-Cookie response header (not subject to that cap) on
 * every navigation, and `persistSession` (still on, default) means
 * this client keeps reading whatever session is already in the
 * cookies. The one place this can matter is the live leaderboard's
 * realtime subscription if left open and untouched for longer than an
 * access token's lifetime (about an hour) -- it already falls back to
 * a manual-refresh view if its connection ever drops, so nothing new
 * breaks, it just relies on that existing fallback slightly sooner in
 * that one long-idle case.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        autoRefreshToken: false,
      },
    },
  );
}
