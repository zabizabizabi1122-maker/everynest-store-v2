/**
 * Admin sidebar configuration (AGENTS.md §10, in the required order).
 *
 * `available` is deliberately explicit. Until a level is approved, its nav item
 * renders as a disabled row with its level badge instead of a link, so the shell
 * never sends staff to a 404 page.
 */

import type { AdminNavIconName } from "./nav-icon";

export interface AdminNavItem {
  label: string;
  href: string;
  icon: AdminNavIconName;
  /** Roadmap level that implements the screen. */
  level: number;
  available: boolean;
}

export const ADMIN_NAV: readonly AdminNavItem[] = [
  { label: "Dashboard", href: "/admin", icon: "dashboard", level: 3, available: true },
  { label: "Categories", href: "/admin/categories", icon: "categories", level: 4, available: true },
  { label: "Products", href: "/admin/products", icon: "products", level: 5, available: true },
  { label: "Inventory", href: "/admin/inventory", icon: "inventory", level: 6, available: true },
  { label: "Suppliers", href: "/admin/suppliers", icon: "suppliers", level: 6, available: true },
  { label: "Orders", href: "/admin/orders", icon: "orders", level: 9, available: true },
  { label: "Customers", href: "/admin/customers", icon: "customers", level: 12, available: true },
  { label: "Reports", href: "/admin/reports", icon: "reports", level: 10, available: true },
  { label: "Coupons", href: "/admin/coupons", icon: "coupons", level: 11, available: true },
  { label: "Reviews", href: "/admin/reviews", icon: "reviews", level: 11, available: true },
];
