import { orderStatusLabel, orderStatusTone, type OrderStatus } from "@/lib/orders";

/** Shared presentational badge; no data access or client hooks. */
export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${orderStatusTone(status)}`}
    >
      {orderStatusLabel(status)}
    </span>
  );
}
