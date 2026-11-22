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
      className="relative inline-flex size-10 items-center justify-center rounded-[10px] border border-[color:var(--border)] bg-[color:var(--surface)] text-foreground transition hover:bg-[color:var(--background)] hover:text-[color:var(--primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--primary)]"
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
      <span
        aria-hidden="true"
        className="absolute -right-1.5 -top-1.5 inline-flex min-w-5 items-center justify-center rounded-full bg-[color:var(--primary)] px-1.5 py-0.5 text-[11px] font-semibold text-white shadow-sm"
      >
        {count}
      </span>
    </button>
  );
}
