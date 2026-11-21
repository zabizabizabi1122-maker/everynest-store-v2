import { cache } from "react";

import { orderDetailSchema, orderListResultSchema, type OrderDetail, type OrderListResult } from "@/lib/orders";
import { createClient } from "@/lib/supabase/server";

export const ORDER_PAGE_SIZE = 20;

/**
 * Loads the signed-in user's visible orders through `public.list_orders`.
 *
 * The RPC already scopes customers to their own rows and lets staff view all
 * orders. It returns bigint totals as decimal strings so this module can safely
 * validate and forward them to the UI.
 */
export const loadOrderList = cache(
  async (options?: {
    page?: number;
    pageSize?: number;
    status?: string | null;
  }): Promise<OrderListResult> => {
    const supabase = await createClient();
    const page = options?.page ?? 1;
    const pageSize = options?.pageSize ?? ORDER_PAGE_SIZE;

    const { data, error } = await supabase.rpc("list_orders", {
      p_page: page,
      p_page_size: pageSize,
      ...(options?.status ? { p_status: options.status } : {}),
    });

    if (error) {
      console.error("list_orders failed", error.code, error.message);
      throw new Error("Could not load orders.");
    }

    const parsed = orderListResultSchema.safeParse(data);
    if (!parsed.success) {
      console.error("list_orders returned an unexpected payload", parsed.error.issues);
      throw new Error("Could not load orders.");
    }

    return parsed.data;
  },
);

/**
 * Loads one authorized order with its immutable invoice lines through
 * `public.get_order`.
 *
 * Returns `null` when the order does not exist or is not visible to the caller;
 * the database uses the same error for both cases to avoid leaking existence.
 */
export async function loadOrder(orderId: string): Promise<OrderDetail | null> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_order", {
    p_order_id: orderId,
  });

  if (error) {
    if (error.code === "P0002") return null;
    console.error("get_order failed", error.code, error.message);
    throw new Error("Could not load this order.");
  }

  const parsed = orderDetailSchema.safeParse(data);
  if (!parsed.success) {
    console.error("get_order returned an unexpected payload", parsed.error.issues);
    throw new Error("Could not load this order.");
  }

  return parsed.data;
}
