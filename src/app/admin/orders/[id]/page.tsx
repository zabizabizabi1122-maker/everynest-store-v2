import type { Metadata } from "next";
import { connection } from "next/server";
import Link from "next/link";
import { notFound } from "next/navigation";

import { OrderContactLinks } from "@/components/admin/order-contact-links";
import { OrderTransitionForm } from "@/components/admin/order-transition-form";
import { secondaryButtonClass } from "@/components/ui/form";
import { OrderStatusBadge } from "@/components/ui/order-status";
import { requireStaff } from "@/lib/auth";
import { loadOrder } from "@/lib/order-data";
import { formatOrderDate, formatOrderPaisa, staffTransitions } from "@/lib/orders";
import { formatPkr } from "@/lib/money";
import { uuidSchema } from "@/lib/validators";

export const metadata: Metadata = {
  title: "Order details · EveryNest Admin",
};

export const instant = false;

interface AdminOrderDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminOrderDetailPage({ params }: AdminOrderDetailPageProps) {
  // Supabase's token-expiry check reads Date.now(); mark this page
  // request-bound before that read so Next.js does not prerender it.
  await connection();

  await requireStaff("/admin/orders");

  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) notFound();

  const order = await loadOrder(id);
  if (!order) notFound();

  const transitions = staffTransitions(order.status);

  return (
    <div>
      <Link href="/admin/orders" className="text-sm font-medium text-[color:var(--brand)] hover:underline">
        ← Back to orders
      </Link>

      <header className="mt-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--brand)]">
            Order detail
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">{order.orderNumber}</h1>
          <p className="mt-1 text-sm text-neutral-600">
            Placed {formatOrderDate(order.createdAt)} · Cash on Delivery
          </p>
        </div>
        <OrderStatusBadge status={order.status} />
      </header>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_20rem]">
        <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
          <div className="border-b border-neutral-200 px-6 py-4">
            <h2 className="text-lg font-semibold">Invoice</h2>
            <p className="mt-0.5 text-xs text-neutral-500">
              Immutable snapshots captured when the order was placed.
            </p>
          </div>
          <ul className="divide-y divide-neutral-100">
            {order.items.map((item) => (
              <li key={item.id} className="flex flex-wrap items-start justify-between gap-4 px-6 py-4">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-neutral-900">{item.productName}</p>
                  <p className="mt-0.5 text-sm text-neutral-600">{item.variantLabel}</p>
                  <p className="mt-1 text-xs text-neutral-500">
                    {formatPkr(item.pricePaisa)} × {item.quantity}
                  </p>
                </div>
                <p className="font-semibold text-neutral-900">{formatOrderPaisa(item.lineTotalPaisa)}</p>
              </li>
            ))}
          </ul>
          <dl className="space-y-2 border-t border-neutral-200 bg-neutral-50 px-6 py-5 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-neutral-600">Subtotal</dt>
              <dd>{formatOrderPaisa(order.subtotalPaisa)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-neutral-600">Shipping</dt>
              <dd>{formatOrderPaisa(order.shippingPaisa)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-neutral-600">Discount</dt>
              <dd>{formatOrderPaisa(order.discountPaisa)}</dd>
            </div>
            <div className="flex justify-between gap-4 border-t border-neutral-200 pt-3 text-base font-semibold">
              <dt>Total</dt>
              <dd>{formatOrderPaisa(order.totalPaisa)}</dd>
            </div>
          </dl>
        </section>

        <aside className="h-fit space-y-6">
          <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-neutral-900">Status controls</h2>
            <OrderTransitionForm orderId={order.id} transitions={transitions} />
          </section>

          <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-neutral-900">Customer & delivery</h2>
            <dl className="mt-3 space-y-3 text-sm">
              <div>
                <dt className="text-neutral-500">Customer</dt>
                <dd className="font-medium text-neutral-900">{order.customerName}</dd>
              </div>
              <div>
                <dt className="text-neutral-500">Mobile</dt>
                <dd className="font-medium text-neutral-900">{order.phone}</dd>
              </div>
              <div>
                <dt className="text-neutral-500">Email</dt>
                <dd className="break-all font-medium text-neutral-900">
                  {order.email?.trim() || "Not provided"}
                </dd>
              </div>
              <div>
                <dt className="text-neutral-500">City</dt>
                <dd className="font-medium text-neutral-900">{order.city}</dd>
              </div>
              <div>
                <dt className="text-neutral-500">Address</dt>
                <dd className="font-medium text-neutral-900">{order.address}</dd>
              </div>
              {order.requirements?.trim() ? (
                <div>
                  <dt className="text-neutral-500">Product requirements</dt>
                  <dd className="whitespace-pre-line font-medium text-neutral-900">
                    {order.requirements}
                  </dd>
                </div>
              ) : null}
              {order.notes?.trim() ? (
                <div>
                  <dt className="text-neutral-500">Order notes</dt>
                  <dd className="whitespace-pre-line font-medium text-neutral-900">
                    {order.notes}
                  </dd>
                </div>
              ) : null}
            </dl>
          </section>

          <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-neutral-900">Contact customer</h2>
            <p className="mt-1 text-xs text-neutral-500">
              Reach out to verify order details before fulfilment.
            </p>
            <OrderContactLinks
              phone={order.phone}
              email={order.email ?? null}
              orderNumber={order.orderNumber}
              customerName={order.customerName}
              firstItemName={order.items[0]?.productName ?? "your order"}
              quantity={order.items[0]?.quantity ?? 1}
            />
          </section>
        </aside>
      </div>

      <Link href="/admin/inventory" className={`${secondaryButtonClass} mt-8`}>
        View inventory movements
      </Link>
    </div>
  );
}
