"use server";

import { revalidatePath } from "next/cache";

import {
  checkoutInputSchema,
  describeCheckoutError,
  GUEST_ORDER_CONFIRMATION_MESSAGE,
  placeOrderResultSchema,
  type CheckoutActionState,
} from "@/lib/checkout";
import { formString, toFieldErrors } from "@/lib/form-state";
import { createClient } from "@/lib/supabase/server";

/**
 * Places a COD order without a customer account.
 *
 * This action is only a Zod-validated adapter around `public.place_order`. It
 * never reads prices or stock from the form, never writes tables directly and
 * never requires a session. The RPC revalidates everything and inserts the
 * order, invoice lines and stock movements in one transaction.
 */
export async function placeOrderAction(
  _previousState: CheckoutActionState,
  formData: FormData,
): Promise<CheckoutActionState> {
  const values = {
    customerName: formString(formData, "customerName"),
    phone: formString(formData, "phone"),
    email: formString(formData, "email"),
    city: formString(formData, "city"),
    address: formString(formData, "address"),
    requirements: formString(formData, "requirements"),
    notes: formString(formData, "notes"),
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
    p_email: parsed.data.email || undefined,
    p_requirements: parsed.data.requirements || undefined,
    p_notes: parsed.data.notes || undefined,
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
      message: "Your order could not be recorded right now. Please try again.",
      fieldErrors: {},
      values,
      order: null,
    };
  }

  // Stock changed, so catalogue availability and the admin screens are stale.
  revalidatePath("/products");
  revalidatePath("/admin/inventory");
  revalidatePath("/admin/orders");

  return {
    status: "success",
    message: GUEST_ORDER_CONFIRMATION_MESSAGE,
    fieldErrors: {},
    values: {},
    order: result.data,
  };
}
