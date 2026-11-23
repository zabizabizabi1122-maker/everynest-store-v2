import type { Metadata } from "next";
import { connection } from "next/server";
import Link from "next/link";

import { inputClass, primaryButtonClass, secondaryButtonClass } from "@/components/ui/form";
import { OrderStatusBadge } from "@/components/ui/order-status";
import { requirePermission } from "@/lib/auth";
import { ORDER_PAGE_SIZE, loadOrderList } from "@/lib/order-data";
import {
  formatOrderDate,
  formatOrderPaisa,
  ORDER_STATUSES,
  orderStatusLabel,
  orderStatusSchema,
} from "@/lib/orders";

export const metadata: Metadata = {
  title: "Orders · EveryNest Admin",
};

export const instant = false;

interface AdminOrdersPageProps {
  searchParams: Promise<{ page?: string; status?: string; q?: string | string[] }>;
}

function parsePage(value: string | undefined): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, 10000) : 1;
}

function parseSearch(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim().slice(0, 100);
  return trimmed || null;
}

function ordersHref(page: number, status: string | null, search: string | null): string {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (search) params.set("q", search);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/admin/orders?${query}` : "/admin/orders";
}

export default async function AdminOrdersPage({ searchParams }: AdminOrdersPageProps) {
  // Supabase's token-expiry check reads Date.now(); mark this page
  // request-bound before that read so Next.js does not prerender it.
  await connection();

  await requirePermission("orders.view", "/admin/orders");

  const params = await searchParams;
  const statusResult = orderStatusSchema.safeParse(params.status);
  const status = statusResult.success ? statusResult.data : null;
  const page = parsePage(params.page);
  const search = parseSearch(params.q);

  const result = await loadOrderList({ page, status, search });
  const total = Number(result.total);
  const pageCount = Math.max(1, Math.ceil(total / ORDER_PAGE_SIZE));

  return (
    <div>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--brand)]">
            Order management
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Orders</h1>
          <p className="mt-1 text-sm text-neutral-600">
            Review COD orders and move them through the fulfilment steps.
          </p>
        </div>
        <Link href="/admin" className={secondaryButtonClass}>
          Back to dashboard
        </Link>
      </header>

      <form action="/admin/orders" method="get" className="mt-6 flex flex-wrap items-center gap-3">
        {status ? <input type="hidden" name="status" value={status} /> : null}
        <div className="min-w-64 flex-1">
          <label htmlFor="order-search" className="sr-only">
            Search orders
          </label>
          <input
            id="order-search"
            name="q"
            type="search"
            defaultValue={search ?? ""}
            maxLength={100}
            placeholder="Search order ID, customer name or phone"
            className={inputClass}
          />
        </div>
        <button type="submit" className={`${primaryButtonClass} mt-1.5`}>
          Search
        </button>
        {search ? (
          <Link
            href={ordersHref(1, status, null)}
            className="mt-1.5 text-sm font-medium text-neutral-600 hover:underline"
          >
            Clear search
          </Link>
        ) : null}
      </form>

      <nav aria-label="Filter orders by status" className="mt-6 flex flex-wrap gap-2">
        <Link
          href={ordersHref(1, null, search)}
          aria-current={status === null ? "page" : undefined}
          className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
            status === null
              ? "bg-[color:var(--brand)] text-white"
              : "border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
          }`}
        >
          All orders
        </Link>
        {ORDER_STATUSES.map((value) => (
          <Link
            key={value}
            href={ordersHref(1, value, search)}
            aria-current={status === value ? "page" : undefined}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
              status === value
                ? "bg-[color:var(--brand)] text-white"
                : "border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
            }`}
          >
            {orderStatusLabel(value)}
          </Link>
        ))}
      </nav>

      <section className="mt-5 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        {result.orders.length === 0 ? (
          <p className="p-10 text-center text-sm text-neutral-600">
            {search
              ? "No orders match your search."
              : status
                ? "No orders with this status yet."
                : "No orders have been placed yet."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-2xl text-left text-sm">
              <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th scope="col" className="px-5 py-3 font-semibold">Order</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Customer</th>
                  <th scope="col" className="px-5 py-3 font-semibold">City</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Placed</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Total</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Status</th>
                  <th scope="col" className="px-5 py-3 text-right font-semibold">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {result.orders.map((order) => (
                  <tr key={order.id} className="transition hover:bg-neutral-50">
                    <td className="px-5 py-4 font-medium text-neutral-900">{order.orderNumber}</td>
                    <td className="px-5 py-4 text-neutral-700">{order.customerName}</td>
                    <td className="px-5 py-4 text-neutral-600">{order.city}</td>
                    <td className="px-5 py-4 text-neutral-600">{formatOrderDate(order.createdAt)}</td>
                    <td className="px-5 py-4 font-semibold text-neutral-900">
                      {formatOrderPaisa(order.totalPaisa)}
                    </td>
                    <td className="px-5 py-4">
                      <OrderStatusBadge status={order.status} />
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Link
                        href={`/admin/orders/${order.id}`}
                        className="font-medium text-[color:var(--brand)] hover:underline"
                      >
                        Manage
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {pageCount > 1 ? (
        <nav aria-label="Orders pagination" className="mt-5 flex items-center justify-between gap-3 text-sm">
          <Link
            href={ordersHref(Math.max(1, page - 1), status, search)}
            aria-disabled={page <= 1}
            className={`${secondaryButtonClass} ${page <= 1 ? "pointer-events-none opacity-50" : ""}`}
          >
            Previous
          </Link>
          <span className="text-neutral-600">
            Page {page} of {pageCount} · {total} orders
          </span>
          <Link
            href={ordersHref(Math.min(pageCount, page + 1), status, search)}
            aria-disabled={page >= pageCount}
            className={`${secondaryButtonClass} ${page >= pageCount ? "pointer-events-none opacity-50" : ""}`}
          >
            Next
          </Link>
        </nav>
      ) : null}
    </div>
  );
}
