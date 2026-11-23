import { createClient } from "@supabase/supabase-js";

import { getPublicEnv } from "@/lib/env";
import type { Database } from "@/types/database.types";

/**
 * Server-only Supabase client for the small set of Auth operations that cannot
 * be performed with a signed-in admin's session (creating a user and setting a
 * password). It is never imported by a Client Component.
 *
 * Every caller must first pass the normal page/action guards; the service role
 * key is not an authorization shortcut.
 */
export function getServiceRoleKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is required for Admin Management. Add it to .env.local (and Vercel) and restart the app.",
    );
  }

  return key;
}

export function isServiceRoleConfigured(): boolean {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
}

export function createAdminClient() {
  const { url } = getPublicEnv();

  return createClient<Database>(url, getServiceRoleKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
