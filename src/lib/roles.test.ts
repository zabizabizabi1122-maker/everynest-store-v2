import { describe, expect, it } from "vitest";

import {
  APP_ROLES,
  canAccessAdmin,
  isAdminRole,
  isAppRole,
  isStaffRole,
  roleLabel,
} from "./roles";

describe("isStaffRole", () => {
  it("allows staff and admin", () => {
    expect(isStaffRole("staff")).toBe(true);
    expect(isStaffRole("admin")).toBe(true);
  });

  it("denies customers, unknown values and missing values", () => {
    expect(isStaffRole("customer")).toBe(false);
    expect(isStaffRole("owner")).toBe(false);
    expect(isStaffRole("ADMIN")).toBe(false);
    expect(isStaffRole("")).toBe(false);
    expect(isStaffRole(null)).toBe(false);
    expect(isStaffRole(undefined)).toBe(false);
  });
});

describe("isAdminRole", () => {
  it("allows only admin", () => {
    expect(isAdminRole("admin")).toBe(true);
    expect(isAdminRole("staff")).toBe(false);
    expect(isAdminRole("customer")).toBe(false);
    expect(isAdminRole(null)).toBe(false);
  });
});

describe("canAccessAdmin", () => {
  it("matches the staff policy", () => {
    for (const role of ["customer", "staff", "admin", "nope", null, undefined]) {
      expect(canAccessAdmin(role)).toBe(isStaffRole(role));
    }
  });
});

describe("isAppRole", () => {
  it("accepts exactly the three database roles", () => {
    expect(APP_ROLES).toEqual(["customer", "staff", "admin"]);
    for (const role of APP_ROLES) expect(isAppRole(role)).toBe(true);
  });

  it("rejects anything else", () => {
    for (const value of ["", "Admin", "superuser", 1, null, undefined, {}]) {
      expect(isAppRole(value)).toBe(false);
    }
  });
});

describe("roleLabel", () => {
  it("formats known roles", () => {
    expect(roleLabel("customer")).toBe("Customer");
    expect(roleLabel("staff")).toBe("Staff");
    expect(roleLabel("admin")).toBe("Admin");
  });

  it("never echoes an unknown role", () => {
    expect(roleLabel("root")).toBe("Customer");
    expect(roleLabel(null)).toBe("Customer");
  });
});
