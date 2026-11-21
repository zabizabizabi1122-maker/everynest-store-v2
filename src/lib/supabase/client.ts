import { createBrowserClient } from "@supabase/ssr";

import { getPublicEnv } from "@/lib/env";
import type { Database } from "@/types/database.types";

/**
 * Browser Supabase client.
 *
 * Uses the public publishable (or legacy anon) key only. It is safe to ship to
 * the browser because Row Level Security and database privileges decide what a
 * visitor may read or write.
 */
export function createClient() {
  const { url, publishableKey } = getPublicEnv();
  return createBrowserClient<Database>(url, publishableKey);
}
