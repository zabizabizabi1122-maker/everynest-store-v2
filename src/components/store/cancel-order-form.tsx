"use client";

import { useActionState } from "react";

import { FormMessage } from "@/components/ui/form";
import { cancelOrderAction } from "@/app/(store)/orders/actions";
import { initialOrderState } from "@/lib/orders";

/**
 * Customer cancellation form. It submits only the order id; the server action
 * fixes the target status and the database RPC performs the real authorization.
 */
export function CancelOrderForm({ orderId }: { orderId: string }) {
  const [state, formAction, isPending] = useActionState(cancelOrderAction, initialOrderState);

  if (state.status === "success") {
    return (
      <FormMessage status="success" message={state.message} />
    );
  }

  return (
    <form action={formAction} className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-4" noValidate>
      <h3 className="text-sm font-semibold text-rose-900">Cancel this order</h3>
      <p className="mt-1 text-xs leading-5 text-rose-800">
        You can cancel while the order is pending. Cancelled orders restore the
        reserved stock; this cannot be undone from your account.
      </p>
      <input type="hidden" name="orderId" value={orderId} />
      <div className="mt-3">
        <FormMessage status={state.status} message={state.message} />
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="mt-3 inline-flex items-center justify-center rounded-xl border border-rose-300 bg-white px-4 py-2.5 text-sm font-semibold text-rose-800 transition hover:bg-rose-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "Cancelling…" : "Cancel order"}
      </button>
    </form>
  );
}
