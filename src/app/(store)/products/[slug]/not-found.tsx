import Link from "next/link";

import { primaryButtonClass } from "@/components/ui/form";

export default function ProductNotFound() {
  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-24 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--primary)]">
        404 · Product
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">We couldn’t find that product</h1>
      <p className="mt-3 text-sm leading-7 text-[color:var(--muted)]">
        It may have been archived or the link may be incorrect. Browse the
        catalogue to find something similar.
      </p>
      <Link href="/products" className={`mt-7 inline-flex ${primaryButtonClass}`}>
        Browse all products
      </Link>
    </div>
  );
}
