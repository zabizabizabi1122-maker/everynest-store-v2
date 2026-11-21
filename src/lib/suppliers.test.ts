import { describe, expect, it } from "vitest";

import { supplierFormSchema } from "./suppliers";

describe("supplierFormSchema", () => {
  const valid = { name: "  Lahore Stationery House ", phone: "+92 42 1234 5678", address: "Urdu Bazaar, Lahore" };

  it("accepts and trims a valid supplier", () => {
    const parsed = supplierFormSchema.safeParse(valid);

    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data).toEqual({
      name: "Lahore Stationery House",
      phone: "+92 42 1234 5678",
      address: "Urdu Bazaar, Lahore",
    });
  });

  it("accepts blank optional phone and address", () => {
    const parsed = supplierFormSchema.safeParse({ name: "Acme", phone: "", address: "" });

    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.phone).toBe("");
    expect(parsed.data.address).toBe("");
  });

  it("rejects short names, long names and invalid names", () => {
    expect(supplierFormSchema.safeParse({ ...valid, name: "A" }).success).toBe(false);
    expect(supplierFormSchema.safeParse({ ...valid, name: "x".repeat(101) }).success).toBe(false);
    expect(supplierFormSchema.safeParse({ ...valid, name: 42 }).success).toBe(false);
  });

  it("rejects malformed phone numbers", () => {
    for (const phone of ["abc", "12345", `+92 ${"9".repeat(40)}`]) {
      expect(supplierFormSchema.safeParse({ ...valid, phone }).success).toBe(false);
    }
    expect(supplierFormSchema.safeParse({ ...valid, phone: "0300-1234567" }).success).toBe(true);
  });

  it("rejects addresses over the length limit", () => {
    expect(supplierFormSchema.safeParse({ ...valid, address: "a".repeat(301) }).success).toBe(false);
  });
});
