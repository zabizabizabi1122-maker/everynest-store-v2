import { cache } from "react";

import { orderDetailSchema, orderListResultSchema, type OrderDetail, type OrderListResult } from "@/lib/orders";
import { createClient } from "@/lib/supabase/server";

export const ORDER_PAGE_SIZE = 20;

/**
 * Loads orders through the staff-only `public.list_orders` RPC.
 *
 * The RPC returns bigint totals as decimal strings so this module can safely
 * validate and forward them to the UI. Search matches order number, customer
 * name or phone inside the database.
 */
export const loadOrderList = cache(
  async (options?: {
    page?: number;
    pageSize?: number;
    status?: string | null;
    search?: string | null;
  }): Promise<OrderListResult> => {
    const supabase = await createClient();
    const page = options?.page ?? 1;
    const pageSize = options?.pageSize ?? ORDER_PAGE_SIZE;

    const { data, error } = await supabase.rpc("list_orders", {
      p_page: page,
      p_page_size: pageSize,
      ...(options?.status ? { p_status: options.status } : {}),
      ...(options?.search ? { p_search: options.search } : {}),
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
 * Loads one order with its immutable invoice lines through `public.get_order`.
 *
 * Returns `null` when the order does not exist; the staff-only RPC uses the same
 * error for a missing id so order existence is not leaked.
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
