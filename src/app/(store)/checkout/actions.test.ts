import { beforeEach, describe, expect, it, vi } from "vitest";

import { GUEST_ORDER_CONFIRMATION_MESSAGE, initialCheckoutState } from "@/lib/checkout";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
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
  phone: "+923001234567",
  email: "test@example.com",
  address: "12 Main Road, Lahore",
  city: "Lahore",
  requirements: "Size M",
  notes: null,
  createdAt: "2026-11-22T00:00:00.000Z",
  items: [
    {
      productName: "Cotton Shirt",
      variantLabel: "size: M",
      quantity: 1,
      pricePaisa: 100000,
      lineTotalPaisa: "100000",
    },
  ],
};

function checkoutForm(overrides: Record<string, string> = {}): FormData {
  const form = new FormData();
  form.set("idempotencyKey", "00000000-0000-4000-8000-000000000001");
  form.set("items", JSON.stringify([{ variantId: "00000000-0000-4000-8000-000000000003", quantity: 1 }]));
  form.set("customerName", "Test Customer");
  form.set("phone", "03001234567");
  form.set("email", "test@example.com");
  form.set("city", "Lahore");
  form.set("address", "12 Main Road, Lahore");
  form.set("requirements", "Size M");
  form.set("notes", "");
  for (const [key, value] of Object.entries(overrides)) form.set(key, value);
  return form;
}

describe("placeOrderAction", () => {
  beforeEach(() => {
    mocks.rpc.mockReset();
    mocks.revalidatePath.mockReset();
    mocks.rpc.mockResolvedValue({ data: validResult, error: null });
  });

  it("places a guest order without requiring a session", async () => {
    const result = await placeOrderAction(initialCheckoutState, checkoutForm());

    expect(result.status).toBe("success");
    expect(result.message).toBe(GUEST_ORDER_CONFIRMATION_MESSAGE);
    expect(result.order?.orderNumber).toBe("ZS-261122-000001");
    expect(mocks.rpc).toHaveBeenCalledWith(
      "place_order",
      expect.objectContaining({
        p_email: "test@example.com",
        p_requirements: "Size M",
        p_notes: undefined,
      }),
    );
  });

  it("omits optional email, requirements and notes when left blank", async () => {
    await placeOrderAction(
      initialCheckoutState,
      checkoutForm({ email: "", requirements: "", notes: "" }),
    );

    expect(mocks.rpc).toHaveBeenCalledWith(
      "place_order",
      expect.objectContaining({
        p_email: undefined,
        p_requirements: undefined,
        p_notes: undefined,
      }),
    );
  });

  it("does not call the RPC when validation fails", async () => {
    const result = await placeOrderAction(
      initialCheckoutState,
      checkoutForm({ phone: "123" }),
    );

    expect(result.status).toBe("error");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
