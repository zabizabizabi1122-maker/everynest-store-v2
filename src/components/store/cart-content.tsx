"use client";

import Link from "next/link";

import { useCart } from "@/components/store/cart-provider";
import { ProductImage } from "@/components/store/product-image";
import { estimateCheckoutTotals } from "@/lib/checkout";
import { MAX_CART_QUANTITY, trustedCartImageUrl } from "@/lib/cart";
import { formatPkr } from "@/lib/money";
import { primaryButtonClass, secondaryButtonClass } from "@/components/ui/form";

/** Full-page cart. Everything here is a display snapshot, not an order total. */
export function CartContent() {
  const { items, count, setQuantity, removeItem, clear } = useCart();
  const totals = estimateCheckoutTotals(items);

  if (items.length === 0) {
    return (
      <section className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-10 text-center shadow-sm">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-[color:var(--background)] text-neutral-400">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" className="size-7">
            <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
            <path d="M3 6h18M16 10a4 4 0 0 1-8 0" />
          </svg>
        </span>
        <h2 className="mt-5 text-lg font-semibold">Your cart is empty</h2>
        <p className="mt-1.5 text-sm text-[color:var(--muted)]">
          Browse the catalogue and add a variant you like.
        </p>
        <Link href="/products" className={`${primaryButtonClass} mt-6`}>
          Browse products
        </Link>
      </section>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
      <section aria-labelledby="cart-items-heading" className="overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] shadow-sm">
        <div className="flex items-center justify-between gap-4 border-b border-[color:var(--border)] px-5 py-4">
          <h2 id="cart-items-heading" className="text-base font-semibold">
            Items in your cart
            <span className="ml-2 text-sm font-normal text-[color:var(--muted)]">
              {count} {count === 1 ? "item" : "items"}
            </span>
          </h2>
          <button
            type="button"
            onClick={clear}
            className="rounded-lg px-2 py-1 text-xs font-medium text-[color:var(--muted)] transition hover:bg-[color:var(--background)] hover:text-red-600 focus-visible:outline-2 focus-visible:outline-[color:var(--primary)]"
          >
            Clear all
          </button>
        </div>

        <ul className="divide-y divide-neutral-100">
          {items.map((item) => (
            <li key={item.variantId} className="flex flex-wrap gap-4 px-5 py-5 sm:flex-nowrap">
              <div className="relative size-24 shrink-0 overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--background)]">
                <ProductImage
                  src={trustedCartImageUrl(item.display.imageUrl)}
                  alt={item.display.name}
                  sizes="96px"
                />
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[color:var(--foreground)]">{item.display.name}</p>
                {item.display.attributesLabel ? (
                  <p className="mt-0.5 text-xs text-[color:var(--muted)]">{item.display.attributesLabel}</p>
                ) : null}
                <p className="mt-1.5 text-sm font-semibold text-[color:var(--primary)]">
                  {formatPkr(item.display.displayUnitPricePaisa)}
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <div className="inline-flex items-center rounded-lg border border-[color:var(--border)]">
                    <button
                      type="button"
                      onClick={() => setQuantity(item.variantId, item.quantity - 1)}
                      aria-label={`Decrease quantity of ${item.display.name}`}
                      className="px-2.5 py-1.5 text-[color:var(--muted)] transition hover:bg-[color:var(--background)]"
                    >
                      −
                    </button>
                    <span aria-live="polite" className="min-w-7 text-center text-sm font-medium">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => setQuantity(item.variantId, Math.min(item.quantity + 1, MAX_CART_QUANTITY))}
                      disabled={item.quantity >= MAX_CART_QUANTITY}
                      aria-label={`Increase quantity of ${item.display.name}`}
                      className="px-2.5 py-1.5 text-[color:var(--muted)] transition hover:bg-[color:var(--background)] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      +
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(item.variantId)}
                    className="text-xs font-medium text-[color:var(--muted)] transition hover:text-red-600 focus-visible:outline-2 focus-visible:outline-[color:var(--primary)]"
                  >
                    Remove
                  </button>
                </div>
              </div>

              <p className="text-sm font-semibold text-[color:var(--foreground)] sm:text-right">
                {formatPkr(BigInt(item.display.displayUnitPricePaisa) * BigInt(item.quantity))}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <aside aria-labelledby="cart-summary" className="h-fit rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-6 shadow-sm">
        <h2 id="cart-summary" className="text-lg font-semibold">Order estimate</h2>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-[color:var(--muted)]">Subtotal</dt>
            <dd>{formatPkr(totals.subtotal)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-[color:var(--muted)]">Shipping</dt>
            <dd className="text-emerald-700">Free</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-[color:var(--muted)]">Discount</dt>
            <dd>{formatPkr(totals.discount)}</dd>
          </div>
          <div className="flex justify-between gap-4 border-t border-[color:var(--border)] pt-3 text-base font-semibold">
            <dt>Estimated total</dt>
            <dd>{formatPkr(totals.total)}</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs leading-5 text-[color:var(--muted)]">
          Prices are from your cart snapshot. Availability and final totals are confirmed when you
          place the order.
        </p>
        <Link href="/checkout" className={`${primaryButtonClass} mt-5 w-full`}>
          Proceed to checkout
        </Link>
        <Link href="/products" className={`${secondaryButtonClass} mt-3 w-full justify-center`}>
          Continue shopping
        </Link>
      </aside>
    </div>
  );
}
