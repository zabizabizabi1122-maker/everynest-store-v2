"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth";
import { formString, toFieldErrors } from "@/lib/form-state";
import {
  describeOrderError,
  orderDetailSchema,
  transitionInputSchema,
  type OrderActionState,
} from "@/lib/orders";
import { createClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validators";

/**
 * Cancels the signed-in customer's own pending order.
 *
 * The only mutable field sent to the database is the order id. The target
 * status is fixed here; `public.transition_order_status` re-checks ownership and
 * the pending status under a row lock and restores stock exactly once.
 */
export async function cancelOrderAction(
  _previousState: OrderActionState,
  formData: FormData,
): Promise<OrderActionState> {
  await requireUser("/orders");

  const rawOrderId = formString(formData, "orderId");
  const orderId = uuidSchema.safeParse(rawOrderId);

  if (!orderId.success) {
    return {
      status: "error",
      message: "Please check the highlighted fields.",
      fieldErrors: toFieldErrors(orderId.error),
      order: null,
    };
  }

  const parsed = transitionInputSchema.safeParse({
    orderId: orderId.data,
    targetStatus: "cancelled",
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please check the highlighted fields.",
      fieldErrors: toFieldErrors(parsed.error),
      order: null,
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("transition_order_status", {
    p_order_id: parsed.data.orderId,
    p_target_status: parsed.data.targetStatus,
  });

  if (error) {
    console.error("transition_order_status (cancel) failed", error.code, error.message);
    return {
      status: "error",
      message: describeOrderError(error.code),
      fieldErrors: {},
      order: null,
    };
  }

  const result = orderDetailSchema.safeParse(data);
  if (!result.success) {
    console.error("cancel order returned an unexpected payload", result.error.issues);
    return {
      status: "error",
      message: describeOrderError(undefined),
      fieldErrors: {},
      order: null,
    };
  }

  revalidatePath("/orders");
  revalidatePath(`/orders/${result.data.id}`);
  revalidatePath("/account");
  revalidatePath("/products");
  revalidatePath("/admin/inventory");
  revalidatePath("/admin/orders");

  return {
    status: "success",
    message: `Order ${result.data.orderNumber} was cancelled. Stock has been restored.`,
    fieldErrors: {},
    order: {
      id: result.data.id,
      orderNumber: result.data.orderNumber,
      status: result.data.status,
    },
  };
}
