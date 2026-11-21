"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth";
import {
  checkoutInputSchema,
  describeCheckoutError,
  placeOrderResultSchema,
  type CheckoutActionState,
} from "@/lib/checkout";
import { formString, toFieldErrors } from "@/lib/form-state";
import { createClient } from "@/lib/supabase/server";

/**
 * Places a COD order.
 *
 * This action is only a Zod-validated adapter around `public.place_order`. It
 * never reads prices or stock from the form and never writes tables directly.
 * The function re-derives the customer from the verified session and rebuilds
 * the entire order in one database transaction.
 */
export async function placeOrderAction(
  _previousState: CheckoutActionState,
  formData: FormData,
): Promise<CheckoutActionState> {
  await requireUser("/checkout");

  const values = {
    customerName: formString(formData, "customerName"),
    phone: formString(formData, "phone"),
    city: formString(formData, "city"),
    address: formString(formData, "address"),
  };

  let items: unknown;
  try {
    items = JSON.parse(formString(formData, "items"));
  } catch {
    items = null;
  }

  const parsed = checkoutInputSchema.safeParse({
    idempotencyKey: formString(formData, "idempotencyKey"),
    items,
    ...values,
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please check the highlighted fields.",
      fieldErrors: toFieldErrors(parsed.error),
      values,
      order: null,
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("place_order", {
    p_idempotency_key: parsed.data.idempotencyKey,
    p_items: parsed.data.items,
    p_customer_name: parsed.data.customerName,
    p_phone: parsed.data.phone,
    p_address: parsed.data.address,
    p_city: parsed.data.city,
    p_coupon_code: parsed.data.couponCode || undefined,
  });

  if (error) {
    // Technical detail stays on the server; the client sees a safe message.
    console.error("place_order failed", error.code, error.message);
    return {
      status: "error",
      message: describeCheckoutError(error.code),
      fieldErrors: {},
      values,
      order: null,
    };
  }

  const result = placeOrderResultSchema.safeParse(data);
  if (!result.success) {
    console.error("place_order returned an unexpected payload");
    return {
      status: "error",
      message: "Your order could not be confirmed right now. Please try again.",
      fieldErrors: {},
      values,
      order: null,
    };
  }

  // Stock changed, so catalogue availability and the inventory screen are stale.
  revalidatePath("/products");
  revalidatePath("/admin/inventory");

  return {
    status: "success",
    message: `Order ${result.data.orderNumber} has been placed. Pay on delivery.`,
    fieldErrors: {},
    values: {},
    order: {
      id: result.data.id,
      orderNumber: result.data.orderNumber,
      totalPaisa: result.data.totalPaisa,
    },
  };
}
