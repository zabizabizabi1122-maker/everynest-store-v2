import { beforeEach, describe, expect, it, vi } from "vitest";

import { initialCheckoutState } from "@/lib/checkout";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  requireUser: vi.fn(async () => ({ id: "00000000-0000-4000-8000-000000000009" })),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/auth", () => ({ requireUser: mocks.requireUser }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ rpc: mocks.rpc })),
}));

import { placeOrderAction } from "./actions";

const validResult = {
  id: "00000000-0000-4000-8000-000000000002",
  orderNumber: "ZS-261122-000001",
  status: "pending",
  subtotalPaisa: "100000",
  shippingPaisa: "0",
  discountPaisa: "0",
  totalPaisa: "100000",
  customerName: "Test Customer",
  phone: "03001234567",
  address: "12 Main Road, Lahore",
  city: "Lahore",
  createdAt: "2026-11-22T00:00:00.000Z",
};

function checkoutForm(couponCode: string): FormData {
  const form = new FormData();
  form.set("idempotencyKey", "00000000-0000-4000-8000-000000000001");
  form.set("items", JSON.stringify([{ variantId: "00000000-0000-4000-8000-000000000003", quantity: 1 }]));
  form.set("customerName", "Test Customer");
  form.set("phone", "03001234567");
  form.set("city", "Lahore");
  form.set("address", "12 Main Road, Lahore");
  form.set("couponCode", couponCode);
  return form;
}

describe("placeOrderAction", () => {
  beforeEach(() => {
    mocks.rpc.mockReset();
    mocks.revalidatePath.mockReset();
    mocks.rpc.mockResolvedValue({ data: validResult, error: null });
  });

  it("forwards a validated coupon code to place_order", async () => {
    const result = await placeOrderAction(initialCheckoutState, checkoutForm("SAVE10"));

    expect(result.status).toBe("success");
    expect(mocks.rpc).toHaveBeenCalledWith(
      "place_order",
      expect.objectContaining({ p_coupon_code: "SAVE10" }),
    );
  });

  it("sends no coupon when the shopper did not enter one", async () => {
    await placeOrderAction(initialCheckoutState, checkoutForm(""));

    expect(mocks.rpc).toHaveBeenCalledWith(
      "place_order",
      expect.objectContaining({ p_coupon_code: undefined }),
    );
  });
});
