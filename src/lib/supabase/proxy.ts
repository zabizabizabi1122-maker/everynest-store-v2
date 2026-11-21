import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

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
 * This is a convenience/preliminary layer only. Real authorization is enforced
 * again on the server (layouts, Server Actions, Route Handlers) and finally by
 * database RLS and privileges.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const { url, publishableKey } = getPublicEnv();

  const supabase = createServerClient<Database>(url, publishableKey, {
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
  } = await supabase.auth.getUser();

  return { response, user };
}
