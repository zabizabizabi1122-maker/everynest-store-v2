import { describe, expect, it } from "vitest";

import type { CartItem } from "./cart";
import {
  checkoutInputSchema,
  checkoutItemsFromCart,
  createIdempotencyKey,
  describeCheckoutError,
  estimateCheckoutTotals,
  formatDecimalPaisa,
  placeOrderResultSchema,
} from "./checkout";

const VARIANT_A = "b0000000-0000-4000-8000-000000000001";
const VARIANT_B = "b0000000-0000-4000-8000-000000000002";
const KEY = "c0000000-0000-4000-8000-000000000001";

function cartItem(variantId: string, quantity: number, price: number): CartItem {
  return {
    variantId,
    quantity,
    display: {
      name: "Test Product",
      attributesLabel: "Size: M",
      imageUrl: "https://example.com/not-trusted.png",
      displayUnitPricePaisa: price,
    },
  };
}

const validInput = {
  idempotencyKey: KEY,
  items: [{ variantId: VARIANT_A, quantity: 2 }],
  customerName: "  Ayesha Khan  ",
  phone: "0300 1234567",
  email: "  Ayesha@Example.com ",
  city: " Lahore ",
  address: "  12 Main Street, Gulberg  ",
  requirements: "  Size M, blue colour  ",
  notes: "",
};

describe("checkoutInputSchema", () => {
  it("trims fields and normalizes the Pakistani phone number", () => {
    const result = checkoutInputSchema.parse(validInput);

    expect(result.customerName).toBe("Ayesha Khan");
    expect(result.city).toBe("Lahore");
    expect(result.address).toBe("12 Main Street, Gulberg");
    expect(result.phone).toBe("+923001234567");
    expect(result.email).toBe("Ayesha@Example.com");
    expect(result.requirements).toBe("Size M, blue colour");
    expect(result.notes).toBe("");
  });

  it("rejects a short address, bad phone, bad email and empty cart", () => {
    expect(
      checkoutInputSchema.safeParse({ ...validInput, address: "Too short" }).success,
    ).toBe(false);
    expect(checkoutInputSchema.safeParse({ ...validInput, phone: "0211234567" }).success).toBe(
      false,
    );
    expect(checkoutInputSchema.safeParse({ ...validInput, email: "not-an-email" }).success).toBe(
      false,
    );
    expect(checkoutInputSchema.safeParse({ ...validInput, items: [] }).success).toBe(false);
  });

  it("rejects unknown fields and browser-supplied prices", () => {
    expect(
      checkoutInputSchema.safeParse({
        ...validInput,
        items: [{ variantId: VARIANT_A, quantity: 1, pricePaisa: 1 }],
      }).success,
    ).toBe(false);
    expect(checkoutInputSchema.safeParse({ ...validInput, totalPaisa: 1 }).success).toBe(false);
  });

  it("rejects out-of-range quantities and invalid variant ids", () => {
    expect(
      checkoutInputSchema.safeParse({
        ...validInput,
        items: [{ variantId: VARIANT_A, quantity: 100 }],
      }).success,
    ).toBe(false);
    expect(
      checkoutInputSchema.safeParse({
        ...validInput,
        items: [{ variantId: "nope", quantity: 1 }],
      }).success,
    ).toBe(false);
  });
});

describe("checkoutItemsFromCart", () => {
  it("sends only variant ids and quantities, never display data", () => {
    const result = checkoutItemsFromCart([
      cartItem(VARIANT_A, 3, 100000),
      cartItem(VARIANT_B, 2, 50000),
    ]);

    expect(result).toEqual([
      { variantId: VARIANT_A, quantity: 3 },
      { variantId: VARIANT_B, quantity: 2 },
    ]);
  });
});

describe("createIdempotencyKey", () => {
  it("generates a UUID accepted by the checkout schema", () => {
    const key = createIdempotencyKey();
    expect(key).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(checkoutInputSchema.safeParse({ ...validInput, idempotencyKey: key }).success).toBe(
      true,
    );
  });
});

describe("describeCheckoutError", () => {
  it("maps known database codes without exposing SQL text", () => {
    expect(describeCheckoutError("P0001")).toContain("stock");
    expect(describeCheckoutError("P0003")).toContain("different details");
    expect(describeCheckoutError("42501")).toContain("verify this order");
    expect(describeCheckoutError(undefined)).toBe(
      "Your order could not be placed right now. Please try again.",
    );
  });
});

describe("estimateCheckoutTotals", () => {
  it("uses integer arithmetic for display-only estimates", () => {
    const totals = estimateCheckoutTotals([
      cartItem(VARIANT_A, 2, 129950),
      cartItem(VARIANT_B, 1, 49900),
    ]);

    expect(totals.subtotal).toBe(309800n);
    expect(totals.shipping).toBe(0n);
    expect(totals.discount).toBe(0n);
    expect(totals.total).toBe(309800n);
  });
});

describe("placeOrderResultSchema", () => {
  const result = {
    id: "d0000000-0000-4000-8000-000000000001",
    orderNumber: "ZS-202611-000001",
    status: "pending",
    subtotalPaisa: "309800",
    shippingPaisa: "0",
    discountPaisa: "0",
    totalPaisa: "309800",
    customerName: "Ayesha Khan",
    phone: "+923001234567",
    email: "ayesha@example.com",
    address: "12 Main Street, Gulberg",
    city: "Lahore",
    requirements: "Size M, blue colour",
    notes: null,
    createdAt: "2026-11-20T12:00:00Z",
    items: [
      {
        productName: "Cotton Shirt",
        variantLabel: "size: M",
        quantity: 2,
        pricePaisa: 129950,
        lineTotalPaisa: "259900",
      },
    ],
  };

  it("accepts decimal-string bigints from the RPC", () => {
    expect(placeOrderResultSchema.parse(result).totalPaisa).toBe("309800");
    expect(formatDecimalPaisa(result.totalPaisa)).toBe("Rs. 3,098");
  });

  it("rejects numeric totals, missing items and malformed order numbers", () => {
    expect(placeOrderResultSchema.safeParse({ ...result, totalPaisa: 309800 }).success).toBe(false);
    expect(placeOrderResultSchema.safeParse({ ...result, orderNumber: "1" }).success).toBe(false);
    expect(placeOrderResultSchema.safeParse({ ...result, items: [] }).success).toBe(false);
  });
});
