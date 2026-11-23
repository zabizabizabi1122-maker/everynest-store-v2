/**
 * Role helpers for the admin area.
 *
 * `public.profiles.role` is a text column with a CHECK constraint:
 * `'customer' | 'admin' | 'super_admin'`. A role is never accepted from a form,
 * URL, cookie payload or JWT claim — it is always read from the database row
 * that RLS has already scoped to the signed-in user.
 *
 * Super Admin has implicit full access. Admin receives explicit permissions
 * from `role_permissions` and `admin_permissions`. Keeping these decisions in
 * pure functions makes them unit testable and reusable by Server Actions.
 */

export const APP_ROLES = ["customer", "admin", "super_admin"] as const;

export type AppRole = (typeof APP_ROLES)[number];

const ROLE_LABELS: Record<AppRole, string> = {
  customer: "Customer",
  admin: "Admin",
  super_admin: "Super Admin",
};

export function isAppRole(value: unknown): value is AppRole {
  return typeof value === "string" && (APP_ROLES as readonly string[]).includes(value);
}

/**
 * Historical name retained because RLS helpers and callsites use it. It now
 * means "any account allowed in the admin area".
 */
export function isStaffRole(role: string | null | undefined): boolean {
  return role === "admin" || role === "super_admin";
}

/** Broad admin-panel check. Specific mutations use permission keys. */
export function isAdminRole(role: string | null | undefined): boolean {
  return isStaffRole(role);
}

export function isSuperAdminRole(role: string | null | undefined): boolean {
  return role === "super_admin";
}

/** Single decision point for "may this role open /admin at all?". */
export function canAccessAdmin(role: string | null | undefined): boolean {
  return isStaffRole(role);
}

/**
 * Display label. Unknown or missing roles fall back to `Customer` instead of
 * echoing untrusted text into the page.
 */
export function roleLabel(role: string | null | undefined): string {
  return isAppRole(role) ? ROLE_LABELS[role] : "Customer";
}
