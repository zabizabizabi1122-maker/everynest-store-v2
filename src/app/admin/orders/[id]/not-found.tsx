import Link from "next/link";

import { primaryButtonClass } from "@/components/ui/form";

export default function AdminOrderNotFound() {
  return (
    <div className="mx-auto max-w-xl py-24 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--brand)]">
        Order not found
      </p>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight">We couldn’t find that order</h1>
      <p className="mt-3 text-sm text-neutral-600">
        The link may be incorrect or the order may no longer exist.
      </p>
      <Link href="/admin/orders" className={`mt-6 inline-flex ${primaryButtonClass}`}>
        Back to orders
      </Link>
    </div>
  );
}
