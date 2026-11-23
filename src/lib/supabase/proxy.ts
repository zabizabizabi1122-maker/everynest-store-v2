import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

import { getAuthCookieOptions } from "@/lib/auth-security";
import { getPublicEnv } from "@/lib/env";
import type { Database } from "@/types/database.types";

/**
 * Refreshes the Supabase auth session inside the Next.js proxy.
 *
 * Supabase access tokens are short lived. The proxy runs before protected
 * pages, validates the session with `auth.getUser()` (which contacts Supabase
 * Auth instead of trusting a cookie payload) and writes refreshed cookies back
 * to both the request and the response.
 *
 * If the refresh token is expired, rotated away or otherwise invalid, the stale
 * auth cookies are cleared here so the browser cannot keep replaying them.
 * This is a convenience/preliminary layer only: real authorization is enforced
 * again on the server and finally by database RLS and privileges.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const hadAuthCookie = request.cookies
    .getAll()
    .some((cookie) => cookie.name.includes("-auth-token"));

  const { url, publishableKey } = getPublicEnv();

  const supabase = createServerClient<Database>(url, publishableKey, {
    cookieOptions: getAuthCookieOptions(),
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        response = NextResponse.next({ request });

        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  const isSessionError = Boolean(
    error &&
      (error.status === 401 || /refresh token|invalid jwt|session not found|bad jwt/i.test(error.message)),
  );
  const sessionInvalid = hadAuthCookie && isSessionError && !user;

  if (sessionInvalid) {
    const authCookieNames = new Set(
      request.cookies
        .getAll()
        .filter((cookie) => cookie.name.includes("-auth-token"))
        .map((cookie) => cookie.name),
    );

    const preservedCookies = response.cookies
      .getAll()
      .filter((cookie) => !cookie.name.includes("-auth-token"));

    response = NextResponse.next({ request });

    preservedCookies.forEach(({ name, value, ...options }) => {
      response.cookies.set(name, value, options);
    });

    const clearOptions = { ...getAuthCookieOptions(), maxAge: 0 };
    authCookieNames.forEach((name) => {
      response.cookies.set(name, "", clearOptions);
    });
  }

  return { response, user: user ?? null, sessionInvalid };
}
