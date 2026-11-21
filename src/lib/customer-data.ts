import { cache } from "react";

import {
  CUSTOMER_PAGE_SIZE,
  toCustomerListResult,
  type CustomerListResult,
  type CustomerRole,
} from "@/lib/customers";
import { createClient } from "@/lib/supabase/server";

/**
 * Loads the account list for the read-only admin Customers screen.
 *
 * Authorization is enforced in three layers: `requireStaff()` in the page,
 * the `profiles_select_staff` RLS policy (staff/admin only), and the column
 * grant on `public.profiles`. No role-elevation or write operation exists here.
 */
export const loadCustomerList = cache(
  async (options?: {
    page?: number;
    search?: string;
    role?: CustomerRole | null;
  }): Promise<CustomerListResult> => {
    const supabase = await createClient();
    const page = options?.page ?? 1;
    const search = options?.search ?? "";
    const role = options?.role ?? null;

    let query = supabase
      .from("profiles")
      .select("id, full_name, phone, role, created_at", { count: "exact" });

    if (search) {
      // The value is sanitized by sanitizeCustomerSearch() in the page before
      // it reaches this raw PostgREST filter string.
      query = query.or(
        `full_name.ilike.%${search}%,phone.ilike.%${search}%`,
      );
    }
    if (role) query = query.eq("role", role);

    const from = (page - 1) * CUSTOMER_PAGE_SIZE;
    const { data, count, error } = await query
      .order("created_at", { ascending: false })
      .order("id", { ascending: true })
      .range(from, from + CUSTOMER_PAGE_SIZE - 1);

    if (error) {
      console.error("customer list query failed", error.code, error.message);
      throw new Error("Could not load customers.");
    }

    return toCustomerListResult(data ?? [], count ?? 0, page);
  },
);
