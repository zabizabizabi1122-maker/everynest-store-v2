import { describe, expect, it } from "vitest";

import { ADMIN_NAV } from "./nav-items";

describe("admin navigation", () => {
  it("uses unique hrefs under /admin", () => {
    const hrefs = ADMIN_NAV.map((item) => item.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    for (const href of hrefs) expect(href.startsWith("/admin")).toBe(true);
  });

  it("assigns a permission key to every item", () => {
    for (const item of ADMIN_NAV) {
      expect(item.permission).toMatch(/^[a-z][a-z0-9_.]*$/);
    }
  });

  it("exposes Admin Management as an available section", () => {
    const admins = ADMIN_NAV.find((item) => item.href === "/admin/admins");
    expect(admins).toBeDefined();
    expect(admins?.available).toBe(true);
    expect(admins?.permission).toBe("admins.view");
    expect(admins?.badge).toBeUndefined();
  });

  it("links to the newly available management screens", () => {
    const available = ADMIN_NAV.filter((item) => item.available);
    for (const href of ["/admin/admins", "/admin/filters", "/admin/settings", "/admin/profile"]) {
      expect(available.some((item) => item.href === href)).toBe(true);
    }
  });
});
