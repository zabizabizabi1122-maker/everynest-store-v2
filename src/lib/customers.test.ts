import { describe, expect, it } from "vitest";

import {
  CUSTOMER_PAGE_SIZE,
  parseCustomerPage,
  parseCustomerRole,
  sanitizeCustomerSearch,
  toCustomerListResult,
} from "./customers";

const validRow = {
  id: "11111111-1111-4111-8111-111111111111",
  full_name: "  Ahmed Khan  ",
  phone: " +923001234567 ",
  role: "customer",
  created_at: "2026-11-21T10:00:00.000Z",
};

describe("customer admin helpers", () => {
  it("sanitizes PostgREST filter input and caps its length", () => {
    expect(sanitizeCustomerSearch("  Ahmed  ")).toBe("Ahmed");
    expect(sanitizeCustomerSearch("+923001234567")).toBe("+923001234567");
    expect(sanitizeCustomerSearch("a,b(c)\"d\\e")).toBe("abcde");
    expect(sanitizeCustomerSearch("x".repeat(200))).toHaveLength(100);
    expect(sanitizeCustomerSearch(undefined)).toBe("");
  });

  it("only accepts known role filters", () => {
    expect(parseCustomerRole("admin")).toBe("admin");
    expect(parseCustomerRole("staff")).toBe("staff");
    expect(parseCustomerRole("customer")).toBe("customer");
    expect(parseCustomerRole("superadmin")).toBeNull();
    expect(parseCustomerRole(undefined)).toBeNull();
  });

  it("clamps page numbers and falls back on malformed input", () => {
    expect(parseCustomerPage("3")).toBe(3);
    expect(parseCustomerPage("0")).toBe(1);
    expect(parseCustomerPage("abc")).toBe(1);
    expect(parseCustomerPage("999999")).toBe(10000);
    expect(parseCustomerPage(undefined)).toBe(1);
  });

  it("maps valid rows to the safe UI shape", () => {
    const result = toCustomerListResult([validRow], 25, 2);

    expect(result.customers).toEqual([
      {
        id: validRow.id,
        fullName: "Ahmed Khan",
        phone: "+923001234567",
        role: "customer",
        joinedAt: validRow.created_at,
      },
    ]);
    expect(result.total).toBe(25);
    expect(result.pageCount).toBe(Math.ceil(25 / CUSTOMER_PAGE_SIZE));
  });

  it("uses a friendly label for accounts with no name or phone", () => {
    const result = toCustomerListResult(
      [{ ...validRow, full_name: "   ", phone: null }],
      1,
      1,
    );

    expect(result.customers[0].fullName).toBe("Unnamed account");
    expect(result.customers[0].phone).toBeNull();
  });

  it("rejects unexpected payloads instead of rendering raw rows", () => {
    expect(() => toCustomerListResult([{ id: "not-a-uuid" }], 1, 1)).toThrow(
      "Unexpected customer list payload.",
    );
    expect(() => toCustomerListResult(null, 1, 1)).toThrow(
      "Unexpected customer list payload.",
    );
  });
});
