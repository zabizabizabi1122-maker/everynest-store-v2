import type { Metadata } from "next";
import { connection } from "next/server";

import { requireAdmin } from "@/lib/auth";
import { formatDecimalPaisa } from "@/lib/checkout";
import { createClient } from "@/lib/supabase/server";

import { setCouponActiveAction } from "./actions";
import { CouponForm } from "./coupon-form";

export const metadata: Metadata = {
  title: "Coupons · EveryNest Admin",
};

export const instant = false;

export default async function AdminCouponsPage() {
  // Supabase's token-expiry check reads Date.now(); mark this page
  // request-bound before that read so Next.js does not prerender it.
  await connection();

  await requireAdmin("/admin/coupons");

  const supabase = await createClient();
  const { data: coupons, error } = await supabase
    .from("coupons")
    .select("id, code, description, discount_type, discount_value, min_subtotal_paisa, max_uses, used_count, starts_at, ends_at, is_active")
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div className="mx-auto w-full max-w-6xl">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--brand)]">
          Level 11 · Optional features
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Coupons</h1>
        <p className="mt-1.5 text-sm text-neutral-600">
          Discount codes are validated and applied by the checkout transaction, never by the browser.
        </p>
      </header>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_22rem]">
        <section aria-labelledby="coupon-list" className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
          <h2 id="coupon-list" className="border-b border-neutral-200 px-5 py-4 text-base font-semibold">
            Existing codes
          </h2>
          {error ? (
            <p role="alert" className="m-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              Coupons could not be loaded right now.
            </p>
          ) : !coupons || coupons.length === 0 ? (
            <p className="p-6 text-sm text-neutral-600">No coupons yet. Create the first one.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-xl text-left text-sm">
                <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
                  <tr>
                    <th scope="col" className="px-5 py-3 font-semibold">Code</th>
                    <th scope="col" className="px-5 py-3 font-semibold">Discount</th>
                    <th scope="col" className="px-5 py-3 font-semibold">Uses</th>
                    <th scope="col" className="px-5 py-3 font-semibold">Status</th>
                    <th scope="col" className="px-5 py-3 text-right font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {coupons.map((coupon) => (
                    <tr key={coupon.id}>
                      <td className="px-5 py-3.5">
                        <span className="font-mono font-semibold">{coupon.code}</span>
                        <span className="mt-0.5 block text-xs text-neutral-500">
                          {coupon.description || "No description"}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        {coupon.discount_type === "percent"
                          ? `${coupon.discount_value}% off`
                          : `${formatDecimalPaisa(String(coupon.discount_value))} off`}
                        <span className="mt-0.5 block text-xs text-neutral-500">
                          Min {formatDecimalPaisa(String(coupon.min_subtotal_paisa))}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 tabular-nums">
                        {coupon.used_count}
                        {coupon.max_uses !== null ? ` / ${coupon.max_uses}` : " / ∞"}
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                            coupon.is_active ? "bg-emerald-50 text-emerald-700" : "bg-neutral-100 text-neutral-600"
                          }`}
                        >
                          {coupon.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <form action={setCouponActiveAction}>
                          <input type="hidden" name="id" value={coupon.id} />
                          <input type="hidden" name="active" value={coupon.is_active ? "false" : "true"} />
                          <button type="submit" className="text-sm font-medium text-[color:var(--brand)] hover:underline">
                            {coupon.is_active ? "Deactivate" : "Activate"}
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div>
          <CouponForm />
        </div>
      </div>
    </div>
  );
}
