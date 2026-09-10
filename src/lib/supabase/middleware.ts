import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/supabase/database.types";
import { isNativeAppUserAgent } from "@/lib/native-app";
import { applyRememberPolicy, isRemembered, REMEMBER_COOKIE_NAME } from "@/lib/supabase/remember";

type CookieToSet = { name: string; value: string; options: CookieOptions };

const PROTECTED_PREFIXES = ["/dashboard", "/trips", "/account"];

/**
 * Refreshes the Supabase auth session on every request and redirects
 * signed-out visitors away from authenticated routes. Called from
 * middleware.ts.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const remembered = isRemembered(request.cookies.get(REMEMBER_COOKIE_NAME)?.value);

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, applyRememberPolicy(options, remembered)),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isProtected = PROTECTED_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix),
  );

  if (!user && isProtected) {
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // The native app's marketing homepage serves no purpose to a
  // visitor who's already signed in -- they're just reopening the
  // app. Skipping straight to the dashboard avoids a jarring
  // homepage-then-navigate-then-redirect sequence on every cold
  // launch. Scoped to the native app via its User-Agent token (see
  // ios/App/App/MainViewController.swift) so the public website is
  // unaffected -- a signed-in web visitor can still land on and
  // browse "/".
  if (
    user &&
    pathname === "/" &&
    isNativeAppUserAgent(request.headers.get("user-agent") ?? "")
  ) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}
