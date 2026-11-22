"use client";

import Link from "next/link";

import { primaryButtonClass, secondaryButtonClass } from "@/components/ui/form";

/** Storefront-level error boundary; never exposes raw database errors. */
export default function StoreError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-24 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="mt-3 text-sm leading-7 text-[color:var(--muted)]">
        We couldn’t load this page. Please try again or browse the catalogue
        from the beginning.
      </p>
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={reset} className={primaryButtonClass}>
          Try again
        </button>
        <Link href="/products" className={secondaryButtonClass}>
          Browse products
        </Link>
      </div>
    </div>
  );
}
