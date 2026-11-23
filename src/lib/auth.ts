import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { canAccessAdmin, isSuperAdminRole } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/validators";
import type { Database } from "@/types/database.types";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type UserRole = Profile["role"];

export interface AdminAccess {
  role: "admin" | "super_admin";
  isSuperAdmin: boolean;
  permissions: string[];
}

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
 * Server-side guard for pages and actions that need a signed-in account.
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
    .select("id, full_name, phone, role, is_active, created_at, updated_at")
    .eq("id", userId)
    .maybeSingle();

  if (error) return null;

  return data;
});

/**
 * Loads the signed-in user's own profile row.
 */
export async function getCurrentProfile(): Promise<Profile | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  return loadProfile(user.id);
}

/**
 * Server-side guard for every admin page and admin Server Action.
 *
 * The role and active flag are read from `public.profiles` on each request —
 * never from a cookie, JWT claim or form input. Inactive administrator accounts
 * are rejected here, so an existing session cannot survive deactivation.
 */
export async function requireStaff(nextPath = "/admin") {
  const user = await requireUser(nextPath);
  const profile = await loadProfile(user.id);

  if (!profile || !profile.is_active || !canAccessAdmin(profile.role)) {
    redirect("/?notice=staff-only");
  }

  // A verified email is part of the admin account contract. Supabase normally
  // blocks this at sign-in; checking again here also covers an existing session
  // if confirmation settings were changed after it was created.
  if (!user.email_confirmed_at) {
    redirect("/verify-email?notice=verify-required");
  }

  return { user, profile };
}

/**
 * Guard for actions that require any administrative role. Specific permissions
 * are checked with `requirePermission()`.
 */
export async function requireAdmin(nextPath = "/admin") {
  return requireStaff(nextPath);
}

/** Guard for Super Admin-only screens and actions. */
export async function requireSuperAdmin(nextPath = "/admin") {
  const context = await requireStaff(nextPath);

  if (!isSuperAdminRole(context.profile.role)) {
    redirect("/?notice=super-admin-only");
  }

  return context;
}

/**
 * Effective permissions of the signed-in administrator, from a trusted RPC.
 * Super Admin receives every active permission; Admin receives role defaults
 * plus individual grants.
 */
export const getAdminAccess = cache(async (): Promise<AdminAccess | null> => {
  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_my_admin_access");

  if (error || !data || typeof data !== "object") return null;

  const value = data as Record<string, unknown>;
  const role = value.role;
  const permissions = Array.isArray(value.permissions)
    ? value.permissions.filter((item): item is string => typeof item === "string")
    : [];

  if (role !== "admin" && role !== "super_admin") return null;

  return {
    role,
    isSuperAdmin: value.isSuperAdmin === true || role === "super_admin",
    permissions: [...new Set(permissions)],
  };
});

/**
 * Server-side permission guard. Hidden navigation is cosmetic; this check is
 * the authoritative application-layer gate, backed by RLS and trusted RPCs in
 * the database.
 */
export async function requirePermission(permission: string, nextPath = "/admin") {
  const context = await requireStaff(nextPath);
  const access = await getAdminAccess();

  if (!access || (!access.isSuperAdmin && !access.permissions.includes(permission))) {
    redirect("/?notice=permission-denied");
  }

  return { ...context, access };
}

/**
 * Absolute origin of the current request, used for Supabase email links
 * (`emailRedirectTo`). Derived from request headers instead of a hardcoded host
 * so local development and preview deployments both work.
 */
export async function getSiteOrigin(): Promise<string> {
  // APP_URL is optional but recommended in production: it prevents an attacker
  // from influencing email links through a forged Host header.
  const configured = process.env.APP_URL?.trim();
  if (configured) {
    try {
      const url = new URL(configured);
      if (url.protocol === "http:" || url.protocol === "https:") {
        return url.origin;
      }
    } catch {
      // Fall through to request headers for local development.
    }
  }

  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  const protocol = headerStore.get("x-forwarded-proto") ?? "http";

  if (!host) return "http://localhost:3000";

  return `${protocol}://${host}`;
}
