/**
 * Admin sidebar configuration.
 *
 * `permission` is cosmetic only: the shell hides items the signed-in admin
 * cannot use, but every page and Server Action re-checks the same permission on
 * the server. Navigation is never the security layer.
 */

import type { AdminNavIconName } from "./nav-icon";

export interface AdminNavItem {
  label: string;
  href: string;
  icon: AdminNavIconName;
  /** Permission required to see this item. */
  permission: string;
  available: boolean;
  badge?: string;
}

export const ADMIN_NAV: readonly AdminNavItem[] = [
  { label: "Dashboard", href: "/admin", icon: "dashboard", permission: "dashboard.view", available: true },
  { label: "Orders", href: "/admin/orders", icon: "orders", permission: "orders.view", available: true },
  { label: "Products", href: "/admin/products", icon: "products", permission: "products.view", available: true },
  { label: "Categories", href: "/admin/categories", icon: "categories", permission: "categories.view", available: true },
  { label: "Inventory", href: "/admin/inventory", icon: "inventory", permission: "inventory.view", available: true },
  { label: "Suppliers", href: "/admin/suppliers", icon: "suppliers", permission: "suppliers.view", available: true },
  { label: "Customers", href: "/admin/customers", icon: "customers", permission: "customers.view", available: true },
  { label: "Filter Management", href: "/admin/filters", icon: "filters", permission: "filters.view", available: true },
  { label: "Website Settings", href: "/admin/settings", icon: "settings", permission: "settings.view", available: true },
  {
    label: "Admin Management",
    href: "/admin/admins",
    icon: "admins",
    permission: "admins.view",
    available: true,
  },
  { label: "Reports & Analytics", href: "/admin/reports", icon: "reports", permission: "reports.view", available: true },
  { label: "Coupons", href: "/admin/coupons", icon: "coupons", permission: "coupons.view", available: true },
  { label: "Reviews", href: "/admin/reviews", icon: "reviews", permission: "reviews.view", available: true },
  { label: "Profile Settings", href: "/admin/profile", icon: "profile", permission: "dashboard.view", available: true },
];
