import Link from "next/link";

import { primaryButtonClass } from "@/components/ui/form";

export default function OrderNotFound() {
  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-24 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--primary)]">
        Order not found
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">We couldn’t find that order</h1>
      <p className="mt-3 text-sm leading-7 text-[color:var(--muted)]">
        It may belong to a different account or the link may be incorrect. You can
        see all of your orders from the order list.
      </p>
      <Link href="/orders" className={`mt-7 inline-flex ${primaryButtonClass}`}>
        Back to my orders
      </Link>
    </div>
  );
}
