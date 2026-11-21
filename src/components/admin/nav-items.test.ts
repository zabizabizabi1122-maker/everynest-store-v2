import { describe, expect, it } from "vitest";

import { ADMIN_NAV } from "./nav-items";

describe("admin navigation", () => {
  it("keeps the required sidebar order and appends approved Level 11/12 screens", () => {
    expect(ADMIN_NAV.map((item) => item.label)).toEqual([
      "Dashboard",
      "Categories",
      "Products",
      "Inventory",
      "Suppliers",
      "Orders",
      "Customers",
      "Reports",
      "Coupons",
      "Reviews",
    ]);
  });

  it("uses unique hrefs under /admin", () => {
    const hrefs = ADMIN_NAV.map((item) => item.href);

    expect(new Set(hrefs).size).toBe(hrefs.length);
    for (const href of hrefs) expect(href.startsWith("/admin")).toBe(true);
  });

  it("only links to screens that actually exist", () => {
    const available = ADMIN_NAV.filter((item) => item.available);

    expect(available.map((item) => item.href)).toEqual([
      "/admin",
      "/admin/categories",
      "/admin/products",
      "/admin/inventory",
      "/admin/suppliers",
      "/admin/orders",
      "/admin/customers",
      "/admin/reports",
      "/admin/coupons",
      "/admin/reviews",
    ]);
    for (const item of available) expect(item.level).toBeLessThanOrEqual(12);
  });

  it("records a future level for every locked screen", () => {
    for (const item of ADMIN_NAV.filter((entry) => !entry.available)) {
      expect(item.level).toBeGreaterThan(3);
    }
  });
});
