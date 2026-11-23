"use server";

import { revalidatePath } from "next/cache";

import { requirePermission } from "@/lib/auth";
import { formString, toFieldErrors } from "@/lib/form-state";
import {
  describeOrderError,
  orderDetailSchema,
  transitionInputSchema,
  type OrderActionState,
} from "@/lib/orders";
import { createClient } from "@/lib/supabase/server";

/**
 * Staff status changes go only through `public.transition_order_status`.
 *
 * This action validates the submitted shape, but the RPC is the authority: it
 * checks the role, locks the order, enforces the transition and writes the
 * audit and stock rows inside one transaction.
 */
export async function transitionOrderStatusAction(
  _previousState: OrderActionState,
  formData: FormData,
): Promise<OrderActionState> {
  await requirePermission("orders.manage", "/admin/orders");

  const raw = {
    orderId: formString(formData, "orderId"),
    targetStatus: formString(formData, "targetStatus"),
  };

  const parsed = transitionInputSchema.safeParse(raw);
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
    console.error("transition_order_status failed", error.code, error.message);
    return {
      status: "error",
      message: describeOrderError(error.code),
      fieldErrors: {},
      order: null,
    };
  }

  const result = orderDetailSchema.safeParse(data);
  if (!result.success) {
    console.error("transition order returned an unexpected payload", result.error.issues);
    return {
      status: "error",
      message: describeOrderError(undefined),
      fieldErrors: {},
      order: null,
    };
  }

  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${result.data.id}`);
  revalidatePath("/admin/inventory");
  revalidatePath("/products");

  return {
    status: "success",
    message: `Order ${result.data.orderNumber} is now ${result.data.status}.`,
    fieldErrors: {},
    order: {
      id: result.data.id,
      orderNumber: result.data.orderNumber,
      status: result.data.status,
    },
  };
}
