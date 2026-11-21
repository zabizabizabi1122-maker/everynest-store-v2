import { z } from "zod";

import { uuidSchema } from "@/lib/validators";

/**
 * Level 6 — pure inventory rules.
 * Shared by the stock action and its unit tests; the trusted PostgreSQL RPC
 * remains the final authority (it locks the row and rejects negative stock).
 */

export const STOCK_REASONS = ["purchase", "return", "adjustment"] as const;
export type StockReason = (typeof STOCK_REASONS)[number];

export const STOCK_REASON_LABELS: Record<StockReason, string> = {
  purchase: "Purchase",
  return: "Return",
  adjustment: "Adjustment",
};

export const stockAdjustmentSchema = z.object({
  variantId: uuidSchema,
  change: z
    .string()
    .trim()
    .regex(/^-?\d+$/, "Enter a whole number of units.")
    .transform((value) => Number.parseInt(value, 10))
    .refine((value) => value !== 0, "Change cannot be zero.")
    .refine((value) => Math.abs(value) <= 100000, "Change must be between -100000 and 100000."),
  reason: z.enum(STOCK_REASONS),
  supplierId: z
    .union([uuidSchema, z.literal("")])
    .transform((value) => (value === "" ? null : value)),
  note: z.string().trim().max(300, "Note must be 300 characters or fewer."),
});

export function isLowStock(stock: number, reorderLevel: number): boolean {
  return stock <= reorderLevel;
}

export type StockLabel = "Out of stock" | "Low stock" | "In stock";

export function stockLabel(stock: number, reorderLevel: number): StockLabel {
  if (stock <= 0) return "Out of stock";
  if (isLowStock(stock, reorderLevel)) return "Low stock";
  return "In stock";
}

/** Maps known database error codes to safe customer/staff-facing text. */
export function describeStockError(code: string | undefined): string {
  switch (code) {
    case "42501":
      return "You are not allowed to change stock.";
    case "22023":
      return "Enter a non-zero whole number and a valid reason.";
    case "P0002":
      return "That variant could not be found. Reload the page and try again.";
    case "P0001":
      return "There is not enough stock for that reduction. Reload and check the current quantity.";
    case "23514":
      return "That change would make stock negative or break a database rule.";
    default:
      return "The stock change could not be saved. Please try again.";
  }
}
