import { z } from "zod";

import { formatDecimalPaisa } from "@/lib/checkout";
import { initialFormState, type FormActionState } from "@/lib/form-state";
import { uuidSchema } from "@/lib/validators";

/**
 * Level 9 — order lifecycle contract.
 *
 * The browser only sends an order id and a desired status. Authorization, valid
 * transitions, stock restoration and auditing all happen inside
 * `public.transition_order_status`. Bigint amounts arrive as validated decimal
 * strings so JavaScript never loses precision.
 */

export const ORDER_STATUSES = [
  "pending",
  "contacted",
  "verified",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_TRANSITION_TARGETS = [
  "contacted",
  "verified",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
] as const;

const decimalPaisaSchema = z.string().regex(/^[0-9]+$/, "Expected a non-negative integer amount.");

export const orderStatusSchema = z.enum(ORDER_STATUSES);
export const transitionTargetSchema = z.enum(ORDER_TRANSITION_TARGETS);

export const transitionInputSchema = z
  .object({
    orderId: uuidSchema,
    targetStatus: transitionTargetSchema,
  })
  .strict();

export const orderSummarySchema = z
  .object({
    id: uuidSchema,
    orderNumber: z.string().regex(/^ZS-[0-9]{6}-[0-9]+$/, "Unexpected order number."),
    status: orderStatusSchema,
    totalPaisa: decimalPaisaSchema,
    customerName: z.string().min(1),
    city: z.string().min(1),
    itemCount: z.number().int().nonnegative(),
    createdAt: z.string().min(1),
  })
  .strict();

export const orderLineSchema = z
  .object({
    id: uuidSchema,
    productName: z.string().min(1),
    variantLabel: z.string().min(1),
    pricePaisa: z.number().int().nonnegative(),
    quantity: z.number().int().min(1).max(99),
    lineTotalPaisa: decimalPaisaSchema,
  })
  .strict();

export const orderDetailSchema = z
  .object({
    id: uuidSchema,
    orderNumber: z.string().regex(/^ZS-[0-9]{6}-[0-9]+$/, "Unexpected order number."),
    status: orderStatusSchema,
    subtotalPaisa: decimalPaisaSchema,
    shippingPaisa: decimalPaisaSchema,
    discountPaisa: decimalPaisaSchema,
    totalPaisa: decimalPaisaSchema,
    customerName: z.string().min(1),
    phone: z.string().min(1),
    email: z.string().nullable(),
    address: z.string().min(1),
    city: z.string().min(1),
    requirements: z.string().nullable(),
    notes: z.string().nullable(),
    createdAt: z.string().min(1),
    items: z.array(orderLineSchema),
  })
  .strict();

export const orderListResultSchema = z
  .object({
    orders: z.array(orderSummarySchema),
    total: decimalPaisaSchema,
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
  })
  .strict();

export type OrderSummary = z.infer<typeof orderSummarySchema>;
export type OrderLine = z.infer<typeof orderLineSchema>;
export type OrderDetail = z.infer<typeof orderDetailSchema>;
export type OrderListResult = z.infer<typeof orderListResultSchema>;
export type TransitionTarget = z.infer<typeof transitionTargetSchema>;
export type OrderTransitionTarget = TransitionTarget;

export interface OrderActionState extends FormActionState {
  order: Pick<OrderDetail, "id" | "orderNumber" | "status"> | null;
}

export const initialOrderState: OrderActionState = {
  ...initialFormState,
  order: null,
};

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Pending",
  contacted: "Contacted",
  verified: "Verified",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export function orderStatusLabel(status: OrderStatus): string {
  return STATUS_LABELS[status] ?? status;
}

export function orderStatusTone(status: OrderStatus): string {
  switch (status) {
    case "pending":
      return "bg-amber-50 text-amber-700";
    case "contacted":
      return "bg-orange-50 text-orange-700";
    case "verified":
      return "bg-sky-50 text-sky-700";
    case "processing":
      return "bg-violet-50 text-violet-700";
    case "shipped":
      return "bg-indigo-50 text-indigo-700";
    case "delivered":
      return "bg-emerald-50 text-emerald-700";
    case "cancelled":
      return "bg-neutral-100 text-neutral-600";
  }
}

/** Statuses a staff member may move an order to, based on the database rules. */
export function staffTransitions(status: OrderStatus): TransitionTarget[] {
  switch (status) {
    case "pending":
      return ["contacted", "cancelled"];
    case "contacted":
      return ["verified", "cancelled"];
    case "verified":
      return ["processing", "cancelled"];
    case "processing":
      return ["shipped", "cancelled"];
    case "shipped":
      return ["delivered"];
    case "delivered":
    case "cancelled":
      return [];
  }
}

/** Maps database error codes to safe customer-facing messages. */
export function describeOrderError(code: string | undefined): string {
  switch (code) {
    case "42501":
      return "You are not allowed to change this order.";
    case "22023":
      return "That status change is not available for this order.";
    case "P0002":
      return "This order could not be found. Please refresh the page.";
    case "P0001":
      return "The order could not be updated right now. Please try again.";
    default:
      return "We could not update this order right now. Please try again.";
  }
}

export function formatOrderDate(value: string): string {
  return new Intl.DateTimeFormat("en-PK", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function formatOrderPaisa(value: string): string {
  return formatDecimalPaisa(value);
}
