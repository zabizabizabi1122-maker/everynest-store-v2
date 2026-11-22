"use client";

import Link from "next/link";
import { useEffect } from "react";

import {
  cartSubtotalPaisa,
  MAX_CART_QUANTITY,
  trustedCartImageUrl,
} from "@/lib/cart";
import { formatPkr } from "@/lib/money";

import { ProductImage } from "./product-image";
import { useCart } from "./cart-provider";

/** Slide-over cart. Non-authoritative: totals are display-only snapshots. */
export function CartDrawer() {
  const { items, count, isOpen, closeCart, setQuantity, removeItem, clear } = useCart();

  useEffect(() => {
    if (!isOpen) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeCart();
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen, closeCart]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close cart"
        onClick={closeCart}
        className="absolute inset-0 bg-neutral-900/40 backdrop-blur-sm"
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-heading"
        className="relative flex h-full w-full max-w-md flex-col bg-[color:var(--surface)] shadow-2xl"
      >
        <header className="flex items-center justify-between gap-4 border-b border-[color:var(--border)] px-5 py-4">
          <div>
            <h2 id="cart-heading" className="text-lg font-semibold">
              Your cart
            </h2>
            <p className="mt-0.5 text-xs text-[color:var(--muted)]">
              {count} {count === 1 ? "item" : "items"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {items.length > 0 ? (
              <button
                type="button"
                onClick={clear}
                className="rounded-lg px-2 py-1 text-xs font-semibold text-[color:var(--muted)] transition hover:bg-[color:var(--background)] hover:text-red-600 focus-visible:outline-2 focus-visible:outline-[color:var(--primary)]"
              >
                Clear all
              </button>
            ) : null}
            <button
              type="button"
              onClick={closeCart}
              aria-label="Close cart"
              className="rounded-lg p-2 text-[color:var(--muted)] transition hover:bg-[color:var(--background)] hover:text-[color:var(--foreground)] focus-visible:outline-2 focus-visible:outline-[color:var(--primary)]"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" className="size-5">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </header>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
            <span className="flex size-16 items-center justify-center rounded-full bg-[color:var(--background)] text-neutral-400">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" className="size-8">
                <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                <path d="M3 6h18M16 10a4 4 0 0 1-8 0" />
              </svg>
            </span>
            <h3 className="mt-5 text-base font-semibold">Your cart is empty</h3>
            <p className="mt-1.5 text-sm text-[color:var(--muted)]">
              Browse the catalogue and add a variant you like.
            </p>
            <Link
              href="/products"
              onClick={closeCart}
              className="mt-6 inline-flex items-center justify-center rounded-xl bg-[color:var(--brand)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[color:var(--brand)]/90"
            >
              Browse products
            </Link>
          </div>
        ) : (
          <>
            <ul className="flex-1 divide-y divide-neutral-100 overflow-y-auto px-5">
              {items.map((item) => (
                <li key={item.variantId} className="flex gap-4 py-4">
                  <div className="relative size-20 shrink-0 overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--background)]">
                    <ProductImage
                      src={trustedCartImageUrl(item.display.imageUrl)}
                      alt={item.display.name}
                      sizes="80px"
                    />
                  </div>

                  <div className="flex min-w-0 flex-1 flex-col">
                    <p className="truncate text-sm font-semibold text-[color:var(--foreground)]">{item.display.name}</p>
                    {item.display.attributesLabel ? (
                      <p className="mt-0.5 truncate text-xs text-[color:var(--muted)]">{item.display.attributesLabel}</p>
                    ) : null}
                    <p className="mt-1 text-sm font-semibold text-[color:var(--primary)]">
                      {formatPkr(item.display.displayUnitPricePaisa)}
                    </p>

                    <div className="mt-auto flex items-center justify-between gap-3 pt-2">
                      <div className="inline-flex items-center rounded-lg border border-[color:var(--border)]">
                        <button
                          type="button"
                          onClick={() => setQuantity(item.variantId, item.quantity - 1)}
                          aria-label={`Decrease quantity of ${item.display.name}`}
                          className="px-2.5 py-1 text-[color:var(--muted)] transition hover:bg-[color:var(--background)]"
                        >
                          −
                        </button>
                        <span aria-live="polite" className="min-w-6 text-center text-sm font-medium">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => setQuantity(item.variantId, Math.min(item.quantity + 1, MAX_CART_QUANTITY))}
                          disabled={item.quantity >= MAX_CART_QUANTITY}
                          aria-label={`Increase quantity of ${item.display.name}`}
                          className="px-2.5 py-1 text-[color:var(--muted)] transition hover:bg-[color:var(--background)] disabled:cursor-not-allowed disabled:opacity-40"
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
                </li>
              ))}
            </ul>

            <footer className="border-t border-[color:var(--border)] bg-[color:var(--background)] px-5 py-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[color:var(--muted)]">Subtotal (for display)</span>
                <span className="text-lg font-semibold text-[color:var(--foreground)]">
                  {formatPkr(cartSubtotalPaisa(items))}
                </span>
              </div>
              <p className="mt-2 text-xs leading-5 text-[color:var(--muted)]">
                Final prices and availability are confirmed when you place an order.
              </p>
              <Link
                href="/checkout"
                onClick={closeCart}
                className="mt-4 flex w-full items-center justify-center rounded-xl bg-[color:var(--brand)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[color:var(--brand)]/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--primary)]"
              >
                Checkout
              </Link>
              <div className="mt-2 flex gap-2">
                <Link
                  href="/cart"
                  onClick={closeCart}
                  className="flex-1 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-center text-sm font-medium text-[color:var(--foreground)] transition hover:bg-[color:var(--background)] focus-visible:outline-2 focus-visible:outline-[color:var(--primary)]"
                >
                  View cart
                </Link>
                <button
                  type="button"
                  onClick={closeCart}
                  className="flex-1 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm font-medium text-[color:var(--foreground)] transition hover:bg-[color:var(--background)] focus-visible:outline-2 focus-visible:outline-[color:var(--primary)]"
                >
                  Continue shopping
                </button>
              </div>
            </footer>
          </>
        )}
      </aside>
    </div>
  );
}
