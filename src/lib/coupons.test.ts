import { describe, expect, it } from "vitest";

import {
  couponCodeSchema,
  couponTermsSchema,
  createCouponSchema,
  describeCouponTerms,
  estimateCouponDiscountPaisa,
  type CouponTerms,
} from "./coupons";

function terms(overrides: Partial<CouponTerms> = {}): CouponTerms {
  return {
    code: "SAVE10",
    description: "Ten percent off",
    discountType: "percent",
    discountValue: "10",
    minSubtotalPaisa: "1000",
    ...overrides,
  };
}

describe("coupon input validation", () => {
  it("normalizes valid codes to uppercase", () => {
    expect(couponCodeSchema.parse(" save-10 ")).toBe("SAVE-10");
  });

  it("rejects malformed codes", () => {
    expect(couponCodeSchema.safeParse("").success).toBe(false);
    expect(couponCodeSchema.safeParse("-BAD").success).toBe(false);
    expect(couponCodeSchema.safeParse("HAS SPACE").success).toBe(false);
    expect(couponCodeSchema.safeParse("X".repeat(31)).success).toBe(false);
  });

  it("validates the admin create form rules", () => {
    expect(
      createCouponSchema.safeParse({
        code: "SAVE10",
        description: "",
        discountType: "percent",
        discountValue: "10",
        minSubtotalPaisa: "1000",
        maxUses: "5",
        endsAt: "",
      }).success,
    ).toBe(true);

    expect(
      createCouponSchema.safeParse({
        code: "BAD",
        discountType: "percent",
        discountValue: "150",
      }).success,
    ).toBe(false);
  });
});

describe("coupon discount estimates", () => {
  it("respects the minimum subtotal", () => {
    expect(estimateCouponDiscountPaisa(999n, terms())).toBe(0n);
  });

  it("uses integer arithmetic for percent discounts", () => {
    expect(estimateCouponDiscountPaisa(1000n, terms())).toBe(100n);
    expect(estimateCouponDiscountPaisa(999999999999n, terms())).toBe(99999999999n);
  });

  it("caps a fixed discount at the subtotal", () => {
    const fixed = terms({ discountType: "fixed_paisa", discountValue: "50000000000000000000" });
    expect(estimateCouponDiscountPaisa(1000n, fixed)).toBe(1000n);
    expect(estimateCouponDiscountPaisa(2000n, terms({ discountType: "fixed_paisa", discountValue: "500" }))).toBe(500n);
  });
});

describe("coupon payload validation", () => {
  it("accepts a well-formed RPC payload", () => {
    expect(couponTermsSchema.safeParse(terms()).success).toBe(true);
    expect(describeCouponTerms(terms())).toBe("10% off");
  });

  it("rejects numeric money values", () => {
    expect(couponTermsSchema.safeParse({ ...terms(), discountValue: 10 }).success).toBe(false);
  });
});
