import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase client for use in Client Components. Uses the public anon
 * key only — safe to call from the browser. Never import the service
 * role key here or anywhere that ships to the client bundle.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
