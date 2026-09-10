import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/supabase/database.types";
import { applyRememberPolicy, isRemembered, REMEMBER_COOKIE_NAME } from "@/lib/supabase/remember";

type CookieToSet = { name: string; value: string; options: CookieOptions };

/**
 * Supabase client for use in Server Components, Server Actions, and
 * Route Handlers. Reads/writes the session via Next's cookie store.
 *
 * `cookies()` is called first so Next can detect this render as
 * dynamic before any other code runs, which keeps `next build` from
 * needing real Supabase credentials to complete.
 */
export async function createClient() {
  const cookieStore = await cookies();
  const remembered = isRemembered(cookieStore.get(REMEMBER_COOKIE_NAME)?.value);

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, applyRememberPolicy(options, remembered)),
            );
          } catch {
            // Called from a Server Component during render — the
            // middleware below is responsible for refreshing the
            // session cookie in that case, so this can be ignored.
          }
        },
      },
    },
  );
}
