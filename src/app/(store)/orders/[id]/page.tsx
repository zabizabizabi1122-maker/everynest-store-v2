import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CancelOrderForm } from "@/components/store/cancel-order-form";
import { secondaryButtonClass } from "@/components/ui/form";
import { OrderStatusBadge } from "@/components/ui/order-status";
import { requireUser } from "@/lib/auth";
import { loadOrder } from "@/lib/order-data";
import { formatOrderDate, formatOrderPaisa } from "@/lib/orders";
import { formatPkr } from "@/lib/money";
import { uuidSchema } from "@/lib/validators";

export const metadata: Metadata = {
  title: "Order details · EveryNest",
};

interface OrderDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function OrderDetailPage({ params }: OrderDetailPageProps) {
  await requireUser("/orders");

  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) notFound();

  const order = await loadOrder(id);
  if (!order) notFound();

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-12">
      <Link href="/orders" className="text-sm font-medium text-[color:var(--brand)] hover:underline">
        ← Back to my orders
      </Link>

      <header className="mt-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--brand)]">
            Order invoice
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">{order.orderNumber}</h1>
          <p className="mt-1.5 text-sm text-neutral-600">
            Placed {formatOrderDate(order.createdAt)} · Cash on Delivery
          </p>
        </div>
        <OrderStatusBadge status={order.status} />
      </header>

      <section className="mt-8 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <div className="border-b border-neutral-200 px-6 py-4">
          <h2 className="text-lg font-semibold">Items</h2>
          <p className="mt-0.5 text-xs text-neutral-500">
            Prices below are the historical prices captured when this order was placed.
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

      <section className="mt-6 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Delivery details</h2>
        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-neutral-500">Customer</dt>
            <dd className="mt-0.5 font-medium text-neutral-900">{order.customerName}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Mobile</dt>
            <dd className="mt-0.5 font-medium text-neutral-900">{order.phone}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">City</dt>
            <dd className="mt-0.5 font-medium text-neutral-900">{order.city}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-neutral-500">Address</dt>
            <dd className="mt-0.5 font-medium text-neutral-900">{order.address}</dd>
          </div>
        </dl>
        <p className="mt-5 text-xs text-neutral-500">
          Payment is collected on delivery. No online payment was taken.
        </p>
      </section>

      {order.status === "pending" ? <CancelOrderForm orderId={order.id} /> : null}

      <Link href="/products" className={`${secondaryButtonClass} mt-8`}>
        Continue shopping
      </Link>
    </div>
  );
}
