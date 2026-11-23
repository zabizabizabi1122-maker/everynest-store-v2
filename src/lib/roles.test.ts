import { describe, expect, it } from "vitest";

import {
  APP_ROLES,
  canAccessAdmin,
  isAdminRole,
  isAppRole,
  isStaffRole,
  isSuperAdminRole,
  roleLabel,
} from "./roles";

describe("isStaffRole", () => {
  it("allows admin and super_admin", () => {
    expect(isStaffRole("admin")).toBe(true);
    expect(isStaffRole("super_admin")).toBe(true);
  });

  it("denies customers, legacy roles, unknown values and missing values", () => {
    expect(isStaffRole("customer")).toBe(false);
    expect(isStaffRole("staff")).toBe(false);
    expect(isStaffRole("owner")).toBe(false);
    expect(isStaffRole("ADMIN")).toBe(false);
    expect(isStaffRole("")).toBe(false);
    expect(isStaffRole(null)).toBe(false);
    expect(isStaffRole(undefined)).toBe(false);
  });
});

describe("isAdminRole", () => {
  it("allows both administrative roles", () => {
    expect(isAdminRole("admin")).toBe(true);
    expect(isAdminRole("super_admin")).toBe(true);
    expect(isAdminRole("staff")).toBe(false);
    expect(isAdminRole("customer")).toBe(false);
    expect(isAdminRole(null)).toBe(false);
  });
});

describe("isSuperAdminRole", () => {
  it("allows only super_admin", () => {
    expect(isSuperAdminRole("super_admin")).toBe(true);
    expect(isSuperAdminRole("admin")).toBe(false);
    expect(isSuperAdminRole("customer")).toBe(false);
  });
});

describe("canAccessAdmin", () => {
  it("matches the admin-area policy", () => {
    for (const role of ["customer", "admin", "super_admin", "staff", "nope", null, undefined]) {
      expect(canAccessAdmin(role)).toBe(isStaffRole(role));
    }
  });
});

describe("isAppRole", () => {
  it("accepts exactly the three database roles", () => {
    expect(APP_ROLES).toEqual(["customer", "admin", "super_admin"]);
    for (const role of APP_ROLES) expect(isAppRole(role)).toBe(true);
  });

  it("rejects anything else", () => {
    for (const value of ["", "Admin", "staff", "superadmin", "superuser", 1, null, undefined, {}]) {
      expect(isAppRole(value)).toBe(false);
    }
  });
});

describe("roleLabel", () => {
  it("formats known roles", () => {
    expect(roleLabel("customer")).toBe("Customer");
    expect(roleLabel("admin")).toBe("Admin");
    expect(roleLabel("super_admin")).toBe("Super Admin");
  });

  it("never echoes an unknown role", () => {
    expect(roleLabel("root")).toBe("Customer");
    expect(roleLabel("staff")).toBe("Customer");
    expect(roleLabel(null)).toBe("Customer");
  });
});
