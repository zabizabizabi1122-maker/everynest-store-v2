"use client";

import { useCart } from "./cart-provider";

/** Header cart control: opens the drawer and shows the total item count. */
export function CartButton() {
  const { count, openCart } = useCart();

  return (
    <button
      type="button"
      onClick={openCart}
      aria-label={`Open cart, ${count} ${count === 1 ? "item" : "items"}`}
      className="relative inline-flex items-center gap-2 rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-800 transition hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--brand)]"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="size-5"
      >
        <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
        <path d="M3 6h18" />
        <path d="M16 10a4 4 0 0 1-8 0" />
      </svg>
      <span className="hidden sm:inline">Cart</span>
      <span
        aria-hidden="true"
        className="inline-flex min-w-5 items-center justify-center rounded-full bg-[color:var(--brand)] px-1.5 py-0.5 text-xs font-semibold text-white"
      >
        {count}
      </span>
    </button>
  );
}
