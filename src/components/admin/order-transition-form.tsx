"use client";

import { useActionState } from "react";

import { FormMessage, primaryButtonClass, secondaryButtonClass } from "@/components/ui/form";
import { initialOrderState, orderStatusLabel, type TransitionTarget } from "@/lib/orders";

import { transitionOrderStatusAction } from "@/app/admin/orders/actions";

interface OrderTransitionFormProps {
  orderId: string;
  transitions: TransitionTarget[];
}

/**
 * Staff status controls. Only the transitions allowed by the database rules
 * are rendered; the RPC re-checks every one of them before any write happens.
 */
export function OrderTransitionForm({ orderId, transitions }: OrderTransitionFormProps) {
  const [state, formAction, isPending] = useActionState(
    transitionOrderStatusAction,
    initialOrderState,
  );

  if (transitions.length === 0) {
    return (
      <p className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
        This order has reached its final status. No further changes are available.
      </p>
    );
  }

  return (
    <form action={formAction} className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50 p-4" noValidate>
      <h3 className="text-sm font-semibold text-neutral-900">Change order status</h3>
      <p className="mt-1 text-xs text-neutral-600">
        Status changes are recorded in the audit log. Cancelling restores stock exactly once.
      </p>
      <input type="hidden" name="orderId" value={orderId} />
      <div className="mt-3">
        <FormMessage status={state.status} message={state.message} />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {transitions.map((target) =>
          target === "cancelled" ? (
            <button
              key={target}
              type="submit"
              name="targetStatus"
              value={target}
              disabled={isPending}
              className="inline-flex items-center justify-center rounded-xl border border-rose-300 bg-white px-4 py-2.5 text-sm font-semibold text-rose-800 transition hover:bg-rose-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? "Saving…" : `Cancel order`}
            </button>
          ) : (
            <button
              key={target}
              type="submit"
              name="targetStatus"
              value={target}
              disabled={isPending}
              className={target === "confirmed" ? primaryButtonClass : secondaryButtonClass}
            >
              {isPending ? "Saving…" : `Mark ${orderStatusLabel(target).toLowerCase()}`}
            </button>
          ),
        )}
      </div>
    </form>
  );
}
