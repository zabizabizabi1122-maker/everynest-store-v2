/**
 * Role helpers for the admin area.
 *
 * `public.profiles.role` is a text column with a CHECK constraint:
 * `'customer' | 'staff' | 'admin'`. A role is never accepted from a form, URL,
 * cookie payload or JWT claim — it is always read from the database row that
 * Row Level Security has already scoped to the signed-in user.
 *
 * Keeping the decision in pure functions means it can be unit tested and reused
 * by Server Actions without duplicating string comparisons.
 */

export const APP_ROLES = ["customer", "staff", "admin"] as const;

export type AppRole = (typeof APP_ROLES)[number];

const ROLE_LABELS: Record<AppRole, string> = {
  customer: "Customer",
  staff: "Staff",
  admin: "Admin",
};

export function isAppRole(value: unknown): value is AppRole {
  return typeof value === "string" && (APP_ROLES as readonly string[]).includes(value);
}

/**
 * Staff and admin share the admin panel. Admin additionally owns destructive
 * catalogue and supplier operations (Levels 4–6), so the distinction matters.
 */
export function isStaffRole(role: string | null | undefined): boolean {
  return role === "staff" || role === "admin";
}

export function isAdminRole(role: string | null | undefined): boolean {
  return role === "admin";
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
