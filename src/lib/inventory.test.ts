import { describe, expect, it } from "vitest";

import {
  describeStockError,
  isLowStock,
  stockAdjustmentSchema,
  stockLabel,
} from "./inventory";

const VARIANT_ID = "b0000000-0000-4000-8000-000000000001";
const SUPPLIER_ID = "d0000000-0000-4000-8000-000000000001";

describe("stock helpers", () => {
  it("treats stock at or below the reorder level as low", () => {
    expect(isLowStock(5, 5)).toBe(true);
    expect(isLowStock(4, 5)).toBe(true);
    expect(isLowStock(6, 5)).toBe(false);
  });

  it("labels out-of-stock separately from low stock", () => {
    expect(stockLabel(0, 5)).toBe("Out of stock");
    expect(stockLabel(3, 5)).toBe("Low stock");
    expect(stockLabel(30, 5)).toBe("In stock");
  });

  it("maps database codes to friendly messages", () => {
    expect(describeStockError("P0001")).toContain("not enough stock");
    expect(describeStockError("42501")).toContain("not allowed");
    expect(describeStockError(undefined)).toContain("could not be saved");
  });
});

describe("stockAdjustmentSchema", () => {
  const valid = {
    variantId: VARIANT_ID,
    change: "12",
    reason: "purchase",
    supplierId: SUPPLIER_ID,
    note: "  New delivery  ",
  };

  it("parses a valid adjustment and normalizes optional fields", () => {
    const parsed = stockAdjustmentSchema.safeParse(valid);

    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data).toEqual({
      variantId: VARIANT_ID,
      change: 12,
      reason: "purchase",
      supplierId: SUPPLIER_ID,
      note: "New delivery",
    });
  });

  it("accepts negative adjustments and a blank supplier", () => {
    const parsed = stockAdjustmentSchema.safeParse({
      ...valid,
      change: "-3",
      reason: "adjustment",
      supplierId: "",
    });

    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data).toMatchObject({ change: -3, supplierId: null });
  });

  it("rejects zero, decimals, unsupported reasons and invalid ids", () => {
    for (const change of ["0", "1.5", "abc"]) {
      expect(stockAdjustmentSchema.safeParse({ ...valid, change }).success).toBe(false);
    }
    expect(stockAdjustmentSchema.safeParse({ ...valid, reason: "sale" }).success).toBe(false);
    expect(stockAdjustmentSchema.safeParse({ ...valid, variantId: "nope" }).success).toBe(false);
  });
});
