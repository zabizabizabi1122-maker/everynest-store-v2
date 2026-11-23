import { z } from "zod";

import { isAppRole } from "@/lib/roles";

/**
 * Pure helpers for the read-only admin Customers screen.
 *
 * The database access lives in `customer-data.ts`; keeping the untrusted-input
 * parsing and row mapping here makes the security-sensitive parts unit testable
 * without a Supabase client.
 */

export const CUSTOMER_PAGE_SIZE = 20;

export const customerRoleSchema = z.enum(["customer", "admin", "super_admin"]);

export type CustomerRole = z.infer<typeof customerRoleSchema>;

/** Shape returned to the UI. Only non-sensitive profile fields are exposed. */
export interface CustomerRow {
  id: string;
  fullName: string;
  phone: string | null;
  role: CustomerRole;
  joinedAt: string;
}

export interface CustomerListResult {
  customers: CustomerRow[];
  total: number;
  page: number;
  pageCount: number;
}

/** Raw row as returned by PostgREST, validated before it reaches the UI. */
const rawCustomerSchema = z.object({
  id: z.string().uuid(),
  full_name: z.string().nullable(),
  phone: z.string().nullable(),
  role: customerRoleSchema,
  created_at: z.string().min(1),
});

/**
 * PostgREST's `.or()` filter accepts a raw filter string. Restrict the value to
 * characters that cannot close the value or inject an additional filter clause
 * (comma, quotes, parentheses and backslashes are removed). Digits, spaces,
 * `+`, `@`, `.`, `_` and `-` cover names, emails and Pakistani phone numbers.
 */
export function sanitizeCustomerSearch(input: string | undefined): string {
  return (input ?? "")
    .trim()
    .slice(0, 100)
    .replace(/[^A-Za-z0-9@._+\- ]/g, "");
}

/** Unknown or tampered role values are treated as "no filter". */
export function parseCustomerRole(input: string | undefined): CustomerRole | null {
  return isAppRole(input) ? input : null;
}

/** Positive, bounded page number; malformed input falls back to page 1. */
export function parseCustomerPage(input: string | undefined): number {
  const parsed = Number.parseInt(input ?? "1", 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 10000) : 1;
}

/**
 * Validates an unknown database payload and converts it to the UI shape.
 * Throws on unexpected data so the caller can show a safe error state instead
 * of rendering raw rows.
 */
export function toCustomerListResult(
  rows: unknown,
  total: number,
  page: number,
): CustomerListResult {
  const parsed = z.array(rawCustomerSchema).safeParse(rows);
  if (!parsed.success) {
    throw new Error("Unexpected customer list payload.");
  }

  return {
    customers: parsed.data.map((row) => ({
      id: row.id,
      fullName: row.full_name?.trim() || "Unnamed account",
      phone: row.phone?.trim() || null,
      role: row.role,
      joinedAt: row.created_at,
    })),
    total,
    page,
    pageCount: Math.max(
      1,
      Math.ceil(Math.max(0, total) / CUSTOMER_PAGE_SIZE),
    ),
  };
}
