import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import { getAuthCookieOptions } from "@/lib/auth-security";
import { getPublicEnv } from "@/lib/env";
import type { Database } from "@/types/database.types";

/**
 * Server Supabase client for Server Components, Server Actions and Route
 * Handlers.
 *
 * Session cookies are read from the incoming request. Writes can fail in a
 * pure Server Component render (cookies are read-only there); the session
 * refresh is handled by `src/proxy.ts`, so that failure is intentionally
 * ignored.
 */
export async function createClient() {
  const cookieStore = await cookies();
  const { url, publishableKey } = getPublicEnv();

  return createServerClient<Database>(url, publishableKey, {
    cookieOptions: getAuthCookieOptions(),
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Called from a Server Component where cookies are read-only.
          // The proxy refreshes the session on the next request.
        }
      },
    },
  });
}
