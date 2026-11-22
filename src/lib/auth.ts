import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { canAccessAdmin, isAdminRole } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/validators";
import type { Database } from "@/types/database.types";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type UserRole = Profile["role"];

/**
 * Returns the authenticated user, verified with Supabase Auth.
 *
 * `getUser()` contacts the Auth server and validates the access token. Never use
 * `getSession()` for authorization: its data comes straight from a cookie the
 * browser could have tampered with.
 *
 * Wrapped in React `cache()` so a layout and its page can both ask for the user
 * without making two Auth requests in the same render.
 */
export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
});

/**
 * Server-side guard for pages and actions that need a signed-in customer.
 *
 * `redirect()` is a control-flow helper: it throws, so TypeScript knows the
 * returned user is non-null after this call.
 */
export async function requireUser(nextPath = "/login") {
  const user = await getCurrentUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(safeNextPath(nextPath))}`);
  }

  return user;
}

/**
 * Loads one profile row. RLS limits this to the caller's own row, so asking for
 * another user's id returns nothing rather than somebody else's data.
 */
const loadProfile = cache(async (userId: string): Promise<Profile | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, phone, role, created_at, updated_at")
    .eq("id", userId)
    .maybeSingle();

  if (error) return null;

  return data;
});

/**
 * Loads the signed-in user's own profile row.
 *
 * Row Level Security limits this query to the caller's row, so an unauthenticated
 * or cross-user request cannot read somebody else's profile even if the caller
 * is asked for a different id.
 */
export async function getCurrentProfile(): Promise<Profile | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  return loadProfile(user.id);
}

/**
 * Server-side guard for every admin page and admin Server Action.
 *
 * The role is read from `public.profiles` on each request — not from a cookie,
 * a JWT claim or form input. A signed-in non-staff account that types `/admin`
 * is sent back to the storefront, and calling an admin action directly would hit
 * the same check. RLS and column grants remain the final layer underneath.
 *
 * `redirect()` throws, so callers get a non-null `profile`.
 */
export async function requireStaff(nextPath = "/admin") {
  const user = await requireUser(nextPath);
  const profile = await loadProfile(user.id);

  if (!profile || !canAccessAdmin(profile.role)) {
    redirect("/?notice=staff-only");
  }

  return { user, profile };
}

/**
 * Guard for actions reserved to the admin role. Staff may read suppliers and
 * stock history, but only an admin may create or edit suppliers. As with
 * `requireStaff()`, the role comes from the database row, never from the form.
 */
export async function requireAdmin(nextPath = "/admin") {
  const { user, profile } = await requireStaff(nextPath);

  if (!isAdminRole(profile.role)) {
    redirect("/?notice=admin-only");
  }

  return { user, profile };
}

/**
 * Absolute origin of the current request, used for Supabase email links
 * (`emailRedirectTo`). Derived from request headers instead of a hardcoded host
 * so local development and preview deployments both work.
 */
export async function getSiteOrigin(): Promise<string> {
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  const protocol = headerStore.get("x-forwarded-proto") ?? "http";

  if (!host) return "http://localhost:3000";

  return `${protocol}://${host}`;
}
