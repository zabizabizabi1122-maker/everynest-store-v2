import { z } from "zod";

import { orderSummarySchema } from "@/lib/orders";
import { uuidSchema } from "@/lib/validators";

/**
 * Level 10 — reports and dashboard contract.
 *
 * The RPC is the authority: every figure comes from real order/catalogue rows.
 * This module only validates the JSON envelope and formats it for display.
 * Money stays a decimal string until it reaches a formatting helper so large
 * bigint amounts never pass through a JavaScript number.
 */

export const REPORT_DAYS = [7, 30, 90] as const;
export type ReportDays = (typeof REPORT_DAYS)[number];

const decimalPaisaSchema = z.string().regex(/^[0-9]+$/, "Expected a non-negative integer amount.");

export function isReportDays(value: unknown): value is ReportDays {
  return REPORT_DAYS.includes(value as ReportDays);
}

export function parseReportDays(value: string | undefined): ReportDays {
  const parsed = Number(value);
  return isReportDays(parsed) ? parsed : 30;
}

export function reportsHref(days: ReportDays): string {
  return days === 30 ? "/admin/reports" : `/admin/reports?days=${days}`;
}

const statusCountsSchema = z
  .object({
    pending: z.number().int().nonnegative(),
    confirmed: z.number().int().nonnegative(),
    shipped: z.number().int().nonnegative(),
    delivered: z.number().int().nonnegative(),
    cancelled: z.number().int().nonnegative(),
    all: z.number().int().nonnegative(),
  })
  .strict();

export const dailySalesSchema = z
  .object({
    day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected a report date."),
    orders: z.number().int().nonnegative(),
    revenuePaisa: decimalPaisaSchema,
  })
  .strict();

export const topProductSchema = z
  .object({
    variantId: uuidSchema,
    productName: z.string().min(1),
    variantLabel: z.string().min(1),
    sku: z.string(),
    unitsSold: z.number().int().nonnegative(),
    revenuePaisa: decimalPaisaSchema,
  })
  .strict();

export const lowStockItemSchema = z
  .object({
    variantId: uuidSchema,
    sku: z.string().min(1),
    productName: z.string().min(1),
    stock: z.number().int().nonnegative(),
    reorderLevel: z.number().int().nonnegative(),
  })
  .strict();

export const reportDataSchema = z
  .object({
    generatedAt: z.string().min(1),
    timezone: z.literal("Asia/Karachi"),
    days: z.union([z.literal(7), z.literal(30), z.literal(90)]),
    totalSalesPaisa: decimalPaisaSchema,
    totalOrders: z.number().int().nonnegative(),
    statusCounts: statusCountsSchema,
    activeProducts: z.number().int().nonnegative(),
    activeVariants: z.number().int().nonnegative(),
    lowStockCount: z.number().int().nonnegative(),
    topProducts: z.array(topProductSchema),
    lowStock: z.array(lowStockItemSchema),
    recentOrders: z.array(orderSummarySchema),
    dailySales: z.array(dailySalesSchema),
  })
  .strict();

export type ReportData = z.infer<typeof reportDataSchema>;
export type DailySale = z.infer<typeof dailySalesSchema>;
export type TopProduct = z.infer<typeof topProductSchema>;
export type LowStockItem = z.infer<typeof lowStockItemSchema>;

/** Formats a YYYY-MM-DD report day without shifting it through local timezone. */
export function formatReportDay(day: string): string {
  return new Intl.DateTimeFormat("en-PK", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${day}T00:00:00Z`));
}

/** Largest daily revenue in paisa; zero when there are no days or no sales. */
export function maxDailyRevenue(days: readonly DailySale[]): bigint {
  let max = 0n;
  for (const day of days) {
    const value = BigInt(day.revenuePaisa);
    if (value > max) max = value;
  }
  return max;
}

/** Bar width percentage (0-100) for a daily revenue value. */
export function salesBarWidth(revenuePaisa: string, maxPaisa: bigint): number {
  if (maxPaisa <= 0n) return 0;
  const value = BigInt(revenuePaisa);
  if (value <= 0n) return 0;
  const percent = (value * 100n) / maxPaisa;
  return Number(percent > 100n ? 100n : percent);
}
