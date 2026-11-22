import type { Metadata } from "next";
import Link from "next/link";

import { primaryButtonClass, secondaryButtonClass } from "@/components/ui/form";
import { OrderStatusBadge } from "@/components/ui/order-status";
import { requireUser } from "@/lib/auth";
import { ORDER_PAGE_SIZE, loadOrderList } from "@/lib/order-data";
import {
  formatOrderDate,
  formatOrderPaisa,
  ORDER_STATUSES,
  orderStatusLabel,
  orderStatusSchema,
} from "@/lib/orders";

export const metadata: Metadata = {
  title: "My orders · EveryNest",
  description: "Track and manage your EveryNest orders.",
};

interface OrdersPageProps {
  searchParams: Promise<{ page?: string; status?: string }>;
}

function parsePage(value: string | undefined): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, 10000) : 1;
}

function ordersHref(page: number, status: string | null): string {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/orders?${query}` : "/orders";
}

export default async function OrdersPage({ searchParams }: OrdersPageProps) {
  await requireUser("/orders");

  const params = await searchParams;
  const statusResult = orderStatusSchema.safeParse(params.status);
  const status = statusResult.success ? statusResult.data : null;
  const page = parsePage(params.page);

  const result = await loadOrderList({ page, status });
  const total = Number(result.total);
  const pageCount = Math.max(1, Math.ceil(total / ORDER_PAGE_SIZE));

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-12">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--primary)]">
            Your account
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">My orders</h1>
          <p className="mt-1.5 text-sm text-[color:var(--muted)]">
            Track deliveries, view invoices and cancel a pending order.
          </p>
        </div>
        <Link href="/products" className={secondaryButtonClass}>
          Continue shopping
        </Link>
      </header>

      <nav aria-label="Filter orders by status" className="mt-8 flex flex-wrap gap-2">
        <Link
          href={ordersHref(1, null)}
          aria-current={status === null ? "page" : undefined}
          className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
            status === null
              ? "bg-[color:var(--brand)] text-white"
              : "border border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--foreground)] hover:bg-[color:var(--background)]"
          }`}
        >
          All orders
        </Link>
        {ORDER_STATUSES.map((value) => (
          <Link
            key={value}
            href={ordersHref(1, value)}
            aria-current={status === value ? "page" : undefined}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
              status === value
                ? "bg-[color:var(--brand)] text-white"
                : "border border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--foreground)] hover:bg-[color:var(--background)]"
            }`}
          >
            {orderStatusLabel(value)}
          </Link>
        ))}
      </nav>

      <section className="mt-5 overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] shadow-sm">
        {result.orders.length === 0 ? (
          <div className="p-10 text-center">
            <h2 className="text-lg font-semibold">No orders here yet</h2>
            <p className="mt-2 text-sm text-[color:var(--muted)]">
              {status
                ? "You do not have any orders with this status."
                : "Place your first COD order and it will appear here."}
            </p>
            <Link href="/products" className={`${primaryButtonClass} mt-6`}>
              Browse products
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-xl text-left text-sm">
              <thead className="border-b border-[color:var(--border)] bg-[color:var(--background)] text-xs uppercase tracking-wide text-[color:var(--muted)]">
                <tr>
                  <th scope="col" className="px-5 py-3 font-semibold">Order</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Placed</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Items</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Total</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Status</th>
                  <th scope="col" className="px-5 py-3 text-right font-semibold">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {result.orders.map((order) => (
                  <tr key={order.id} className="transition hover:bg-[color:var(--background)]">
                    <td className="px-5 py-4 font-medium text-[color:var(--foreground)]">{order.orderNumber}</td>
                    <td className="px-5 py-4 text-[color:var(--muted)]">{formatOrderDate(order.createdAt)}</td>
                    <td className="px-5 py-4 text-[color:var(--muted)]">{order.itemCount}</td>
                    <td className="px-5 py-4 font-semibold text-[color:var(--foreground)]">
                      {formatOrderPaisa(order.totalPaisa)}
                    </td>
                    <td className="px-5 py-4">
                      <OrderStatusBadge status={order.status} />
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Link
                        href={`/orders/${order.id}`}
                        className="font-medium text-[color:var(--primary)] hover:underline"
                      >
                        View invoice
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
            href={ordersHref(Math.max(1, page - 1), status)}
            aria-disabled={page <= 1}
            className={`${secondaryButtonClass} ${page <= 1 ? "pointer-events-none opacity-50" : ""}`}
          >
            Previous
          </Link>
          <span className="text-[color:var(--muted)]">
            Page {page} of {pageCount} · {total} orders
          </span>
          <Link
            href={ordersHref(Math.min(pageCount, page + 1), status)}
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
