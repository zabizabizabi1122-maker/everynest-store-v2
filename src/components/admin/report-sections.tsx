import Link from "next/link";

import { formatDecimalPaisa } from "@/lib/checkout";
import { formatOrderDate, formatOrderPaisa, type OrderSummary } from "@/lib/orders";
import {
  formatReportDay,
  maxDailyRevenue,
  salesBarWidth,
  type DailySale,
  type LowStockItem,
  type TopProduct,
} from "@/lib/reports";

const TABLE_HEAD = "px-5 py-3 font-semibold";
const TABLE_CELL = "px-5 py-3.5";

export function SalesOverview({
  days,
  timezone,
  compact = false,
}: {
  days: readonly DailySale[];
  timezone: string;
  compact?: boolean;
}) {
  const max = maxDailyRevenue(days);

  return (
    <section aria-labelledby="sales-overview" className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-neutral-200 px-5 py-4">
        <h2 id="sales-overview" className="text-base font-semibold">Sales overview</h2>
        <p className="text-xs text-neutral-500">Verified, processing, shipped and delivered orders · {timezone} days</p>
      </header>

      <div className={`space-y-3 p-5 ${compact ? "max-h-72 overflow-y-auto" : ""}`}>
        {days.length === 0 ? (
          <p className="text-sm text-neutral-600">No reporting days available.</p>
        ) : (
          days.map((day) => {
            const width = salesBarWidth(day.revenuePaisa, max);
            return (
              <div key={day.day} className="grid grid-cols-[4.5rem_1fr_6.5rem] items-center gap-3 text-xs">
                <span className="text-neutral-600">{formatReportDay(day.day)}</span>
                <div
                  className="h-2.5 overflow-hidden rounded-full bg-neutral-100"
                  role="img"
                  aria-label={`${formatReportDay(day.day)}: ${formatDecimalPaisa(day.revenuePaisa)} from ${day.orders} orders`}
                >
                  <div className="h-full rounded-full bg-[color:var(--brand)]" style={{ width: `${width}%` }} />
                </div>
                <span className="text-right font-medium tabular-nums text-neutral-800">
                  {formatDecimalPaisa(day.revenuePaisa)}
                </span>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

export function TopProductsTable({ products }: { products: readonly TopProduct[] }) {
  return (
    <section aria-labelledby="top-products" className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <header className="border-b border-neutral-200 px-5 py-4">
        <h2 id="top-products" className="text-base font-semibold">Top-selling products</h2>
        <p className="mt-0.5 text-xs text-neutral-500">Ranked by units sold in real, non-cancelled orders.</p>
      </header>
      {products.length === 0 ? (
        <p className="p-6 text-sm text-neutral-600">No sales data yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-lg text-left text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th scope="col" className={TABLE_HEAD}>Product</th>
                <th scope="col" className={TABLE_HEAD}>SKU</th>
                <th scope="col" className={`${TABLE_HEAD} text-right`}>Units</th>
                <th scope="col" className={`${TABLE_HEAD} text-right`}>Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {products.map((product) => (
                <tr key={product.variantId}>
                  <td className={TABLE_CELL}>
                    <span className="font-medium text-neutral-900">{product.productName}</span>
                    <span className="mt-0.5 block text-xs text-neutral-500">{product.variantLabel}</span>
                  </td>
                  <td className={`${TABLE_CELL} font-mono text-xs text-neutral-600`}>{product.sku || "—"}</td>
                  <td className={`${TABLE_CELL} text-right tabular-nums`}>{product.unitsSold}</td>
                  <td className={`${TABLE_CELL} text-right font-medium tabular-nums`}>
                    {formatDecimalPaisa(product.revenuePaisa)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function LowStockTable({ items }: { items: readonly LowStockItem[] }) {
  return (
    <section aria-labelledby="low-stock" className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <header className="border-b border-neutral-200 px-5 py-4">
        <h2 id="low-stock" className="text-base font-semibold">Low-stock report</h2>
        <p className="mt-0.5 text-xs text-neutral-500">Active variants where stock is at or below the reorder level.</p>
      </header>
      {items.length === 0 ? (
        <p className="p-6 text-sm text-neutral-600">No variants are below their reorder level.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-lg text-left text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th scope="col" className={TABLE_HEAD}>Product</th>
                <th scope="col" className={TABLE_HEAD}>SKU</th>
                <th scope="col" className={`${TABLE_HEAD} text-right`}>Stock</th>
                <th scope="col" className={`${TABLE_HEAD} text-right`}>Reorder at</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {items.map((item) => (
                <tr key={item.variantId}>
                  <td className={`${TABLE_CELL} font-medium text-neutral-900`}>{item.productName}</td>
                  <td className={`${TABLE_CELL} font-mono text-xs text-neutral-600`}>{item.sku}</td>
                  <td className={`${TABLE_CELL} text-right font-semibold tabular-nums text-rose-700`}>{item.stock}</td>
                  <td className={`${TABLE_CELL} text-right tabular-nums text-neutral-600`}>{item.reorderLevel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function RecentOrdersTable({ orders }: { orders: readonly OrderSummary[] }) {
  return (
    <section aria-labelledby="recent-orders" className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-neutral-200 px-5 py-4">
        <h2 id="recent-orders" className="text-base font-semibold">Recent orders</h2>
        <Link href="/admin/orders" className="text-xs font-semibold text-[color:var(--brand)] hover:underline">
          All orders →
        </Link>
      </header>
      {orders.length === 0 ? (
        <p className="p-6 text-sm text-neutral-600">No orders have been placed yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-xl text-left text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th scope="col" className={TABLE_HEAD}>Order</th>
                <th scope="col" className={TABLE_HEAD}>Customer</th>
                <th scope="col" className={TABLE_HEAD}>Placed</th>
                <th scope="col" className={`${TABLE_HEAD} text-right`}>Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {orders.map((order) => (
                <tr key={order.id} className="transition hover:bg-neutral-50">
                  <td className={`${TABLE_CELL} font-medium`}>
                    <Link href={`/admin/orders/${order.id}`} className="text-[color:var(--brand)] hover:underline">
                      {order.orderNumber}
                    </Link>
                  </td>
                  <td className={`${TABLE_CELL} text-neutral-700`}>{order.customerName}</td>
                  <td className={`${TABLE_CELL} text-neutral-600`}>{formatOrderDate(order.createdAt)}</td>
                  <td className={`${TABLE_CELL} text-right font-medium tabular-nums`}>
                    {formatOrderPaisa(order.totalPaisa)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
