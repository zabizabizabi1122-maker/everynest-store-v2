import { z } from "zod";

import { MAX_CART_ITEMS, MAX_CART_QUANTITY, type CartItem } from "@/lib/cart";
import { initialFormState, type FormActionState } from "@/lib/form-state";
import { formatPkr } from "@/lib/money";
import { pakistaniPhoneSchema, uuidSchema } from "@/lib/validators";

/**
 * Level 8 — COD checkout contract.
 *
 * The browser sends only variant ids and quantities. Everything monetary and
 * every business rule is recomputed by `public.place_order` in the database.
 * The result's bigint columns are returned as decimal strings so JavaScript
 * never loses precision; they are validated here before being displayed.
 */

/**
 * Free shipping by default. This value is mirrored by the authoritative
 * `v_shipping` constant in `20261120160000_level8_orders.sql`; the database
 * value is what is stored on the order. Change both together if shipping ever
 * becomes non-zero.
 */
export const SHIPPING_PAISA = 0n;
export const DISCOUNT_PAISA = 0n;

export const CHECKOUT_MAX_ITEMS = MAX_CART_ITEMS;
export const CHECKOUT_MAX_QUANTITY = MAX_CART_QUANTITY;

export const checkoutItemSchema = z
  .object({
    variantId: uuidSchema,
    quantity: z.number().int().min(1).max(CHECKOUT_MAX_QUANTITY),
  })
  .strict();

export const checkoutInputSchema = z
  .object({
    idempotencyKey: uuidSchema,
    items: z.array(checkoutItemSchema).min(1).max(CHECKOUT_MAX_ITEMS),
    customerName: z.string().trim().min(2).max(100),
    phone: pakistaniPhoneSchema,
    city: z.string().trim().min(2).max(100),
    address: z.string().trim().min(10).max(500),
    couponCode: z.string().trim().max(30).optional().default(""),
  })
  .strict();

export type CheckoutItem = z.infer<typeof checkoutItemSchema>;
export type CheckoutInput = z.infer<typeof checkoutInputSchema>;

const decimalPaisaSchema = z.string().regex(/^[0-9]+$/, "Expected a non-negative integer amount.");

export const placeOrderResultSchema = z
  .object({
    id: uuidSchema,
    orderNumber: z.string().regex(/^ZS-[0-9]{6}-[0-9]+$/, "Unexpected order number."),
    status: z.enum(["pending", "confirmed", "shipped", "delivered", "cancelled"]),
    subtotalPaisa: decimalPaisaSchema,
    shippingPaisa: decimalPaisaSchema,
    discountPaisa: decimalPaisaSchema,
    totalPaisa: decimalPaisaSchema,
    customerName: z.string().min(1),
    phone: z.string().min(1),
    address: z.string().min(1),
    city: z.string().min(1),
    createdAt: z.string().min(1),
  })
  .strict();

export type PlaceOrderResult = z.infer<typeof placeOrderResultSchema>;

export interface CheckoutActionState extends FormActionState {
  /** Only set after a validated database response; never from client input. */
  order: Pick<PlaceOrderResult, "id" | "orderNumber" | "totalPaisa"> | null;
}

export const initialCheckoutState: CheckoutActionState = {
  ...initialFormState,
  order: null,
};

/**
 * Converts the client cart into the minimal checkout payload. Display prices,
 * images and labels are deliberately dropped: they are never authoritative.
 */
export function checkoutItemsFromCart(items: readonly CartItem[]): CheckoutItem[] {
  return items.slice(0, CHECKOUT_MAX_ITEMS).map((item) => ({
    variantId: item.variantId,
    quantity: Math.min(Math.trunc(item.quantity), CHECKOUT_MAX_QUANTITY),
  }));
}

/**
 * Client-generated UUID v4 for checkout idempotency. Scoped to the signed-in
 * user in the database, so it cannot collide with another customer's key.
 */
export function createIdempotencyKey(): string {
  const browserCrypto = globalThis.crypto;

  if (browserCrypto && typeof browserCrypto.randomUUID === "function") {
    return browserCrypto.randomUUID();
  }

  if (!browserCrypto) {
    throw new Error("Secure random generation is unavailable in this browser.");
  }

  const bytes = browserCrypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Maps database error codes to safe messages; raw SQL is never returned. */
export function describeCheckoutError(code: string | undefined): string {
  switch (code) {
    case "42501":
      return "Please log in again before placing your order.";
    case "22023":
      return "Please check your delivery details and cart, then try again.";
    case "P0002":
      return "An item in your cart or a discount code is no longer valid. Please review and try again.";
    case "P0003":
      return "This checkout was already submitted with different details. Please refresh and try again.";
    case "P0001":
      return "There is not enough stock for an item in your cart. Please review your cart.";
    case "23514":
      return "The order could not be placed because it breaks a store rule.";
    case "23505":
      return "This order was already submitted. Please refresh before trying again.";
    default:
      return "Your order could not be placed right now. Please try again.";
  }
}

/**
 * Display-only estimate from the cart snapshot. The final amounts come from
 * `place_order` and are validated through `placeOrderResultSchema`.
 */
export function estimateCheckoutTotals(items: readonly CartItem[]): {
  subtotal: bigint;
  shipping: bigint;
  discount: bigint;
  total: bigint;
} {
  let subtotal = 0n;

  for (const item of items) {
    subtotal += BigInt(item.display.displayUnitPricePaisa) * BigInt(item.quantity);
  }

  return {
    subtotal,
    shipping: SHIPPING_PAISA,
    discount: DISCOUNT_PAISA,
    total: subtotal + SHIPPING_PAISA - DISCOUNT_PAISA,
  };
}

/** Formats a validated decimal-string paisa amount without using Number. */
export function formatDecimalPaisa(value: string): string {
  return formatPkr(BigInt(value));
}
