"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";

import {
  Field,
  FormMessage,
  fieldDescribedBy,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/ui/form";
import { useCart } from "@/components/store/cart-provider";
import { ProductImage } from "@/components/store/product-image";
import { trustedCartImageUrl } from "@/lib/cart";
import {
  checkoutItemsFromCart,
  createIdempotencyKey,
  estimateCheckoutTotals,
  formatDecimalPaisa,
  initialCheckoutState,
} from "@/lib/checkout";
import { formatPkr } from "@/lib/money";
import { orderStatusLabel } from "@/lib/orders";

import { placeOrderAction } from "./actions";

/**
 * Guest COD order form. Cart contents are rendered from the non-authoritative
 * client store; only variant ids and quantities are submitted. The Server
 * Action revalidates every line in `public.place_order`.
 */
export function CheckoutForm() {
  const { items, count, clear } = useCart();
  const [state, formAction, isPending] = useActionState(placeOrderAction, initialCheckoutState);
  const keyInput = useRef<HTMLInputElement>(null);
  const itemsInput = useRef<HTMLInputElement>(null);
  const clearedOrder = useRef<string | null>(null);

  const totals = estimateCheckoutTotals(items);
  const orderId = state.order?.id ?? null;

  useEffect(() => {
    if (!orderId || clearedOrder.current === orderId) return;

    // A received order leaves the cart; a retry must use a fresh key.
    clearedOrder.current = orderId;
    clear();
    if (keyInput.current) keyInput.current.value = "";
  }, [orderId, clear]);

  function prepareSubmit() {
    if (keyInput.current && keyInput.current.value === "") {
      keyInput.current.value = createIdempotencyKey();
    }
    if (itemsInput.current) {
      itemsInput.current.value = JSON.stringify(checkoutItemsFromCart(items));
    }
  }

  const errorFor = (name: string) => state.fieldErrors[name]?.[0];

  if (state.order) {
    const order = state.order;

    return (
      <section
        aria-labelledby="order-received"
        className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-6 text-center shadow-sm"
      >
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-sky-50 text-sky-700">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="size-6">
            <path d="m5 13 4 4L19 7" />
          </svg>
        </span>
        <h2 id="order-received" className="mt-4 text-xl font-semibold text-[color:var(--foreground)]">
          Order received
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-[color:var(--muted)]">{state.message}</p>

        <dl className="mx-auto mt-5 max-w-md divide-y divide-[color:var(--border)] text-left text-sm">
          <div className="flex items-center justify-between gap-4 py-2">
            <dt className="text-[color:var(--muted)]">Order ID</dt>
            <dd className="font-semibold text-[color:var(--foreground)]">{order.orderNumber}</dd>
          </div>
          <div className="flex items-center justify-between gap-4 py-2">
            <dt className="text-[color:var(--muted)]">Customer</dt>
            <dd className="font-semibold text-[color:var(--foreground)]">{order.customerName}</dd>
          </div>
          <div className="flex items-center justify-between gap-4 py-2">
            <dt className="text-[color:var(--muted)]">Status</dt>
            <dd className="font-semibold text-amber-700">{orderStatusLabel(order.status)}</dd>
          </div>
          <div className="flex items-center justify-between gap-4 py-2">
            <dt className="text-[color:var(--muted)]">Total</dt>
            <dd className="font-semibold text-[color:var(--foreground)]">
              {formatDecimalPaisa(order.totalPaisa)}
            </dd>
          </div>
        </dl>

        <div className="mx-auto mt-4 max-w-md rounded-xl border border-[color:var(--border)] bg-[color:var(--background)] p-4 text-left">
          <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
            Ordered items
          </p>
          <ul className="mt-2 space-y-1.5 text-sm">
            {order.items.map((item, index) => (
              <li key={`${item.productName}-${index}`} className="flex justify-between gap-3">
                <span className="text-[color:var(--foreground)]">
                  {item.productName}
                  <span className="ml-1 text-[color:var(--muted)]">({item.variantLabel})</span>
                </span>
                <span className="shrink-0 font-medium text-[color:var(--foreground)]">Qty {item.quantity}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="mt-4 text-xs text-[color:var(--muted)]">
          Your order is pending admin verification. Payment is collected on delivery.
        </p>
        <Link href="/products" className={`${primaryButtonClass} mt-6`}>
          Continue shopping
        </Link>
      </section>
    );
  }

  if (items.length === 0) {
    return (
      <section className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-8 text-center shadow-sm">
        <h2 className="text-lg font-semibold">Your cart is empty</h2>
        <p className="mt-2 text-sm text-[color:var(--muted)]">
          Add a product to your cart before placing an order.
        </p>
        <Link href="/products" className={`${primaryButtonClass} mt-6`}>
          Browse products
        </Link>
      </section>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
      <form
        action={formAction}
        onSubmit={prepareSubmit}
        noValidate
        className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-6 shadow-sm"
      >
        <input ref={keyInput} type="hidden" name="idempotencyKey" defaultValue="" />
        <input ref={itemsInput} type="hidden" name="items" defaultValue="[]" />

        <h2 className="text-lg font-semibold">Your details</h2>
        <p className="mt-1 text-sm text-[color:var(--muted)]">
          We deliver across Pakistan. Cash on delivery only — no card is required.
        </p>

        <div className="mt-5 space-y-4">
          <FormMessage status={state.status} message={state.message} />

          <Field id="customerName" label="Full name" error={errorFor("customerName")}>
            <input
              id="customerName"
              name="customerName"
              type="text"
              autoComplete="name"
              required
              minLength={2}
              maxLength={100}
              defaultValue={state.values?.customerName ?? ""}
              aria-invalid={Boolean(errorFor("customerName"))}
              aria-describedby={fieldDescribedBy("customerName", errorFor("customerName"))}
              className={inputClass}
            />
          </Field>

          <Field
            id="phone"
            label="Mobile number"
            hint="For example 0300 1234567 or +923001234567."
            error={errorFor("phone")}
          >
            <input
              id="phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              required
              maxLength={32}
              defaultValue={state.values?.phone ?? ""}
              aria-invalid={Boolean(errorFor("phone"))}
              aria-describedby={fieldDescribedBy("phone", errorFor("phone"), "phone-hint")}
              className={inputClass}
            />
          </Field>

          <Field
            id="email"
            label="Email address (optional)"
            hint="Recommended so our admin team can email your verification details."
            error={errorFor("email")}
          >
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              maxLength={254}
              defaultValue={state.values?.email ?? ""}
              aria-invalid={Boolean(errorFor("email"))}
              aria-describedby={fieldDescribedBy("email", errorFor("email"), "email-hint")}
              className={inputClass}
            />
          </Field>

          <Field id="city" label="City" error={errorFor("city")}>
            <input
              id="city"
              name="city"
              type="text"
              autoComplete="address-level2"
              required
              minLength={2}
              maxLength={100}
              defaultValue={state.values?.city ?? ""}
              aria-invalid={Boolean(errorFor("city"))}
              aria-describedby={fieldDescribedBy("city", errorFor("city"))}
              className={inputClass}
            />
          </Field>

          <Field
            id="address"
            label="Complete delivery address"
            hint="Include house number, street, area and postal code if you have one."
            error={errorFor("address")}
          >
            <textarea
              id="address"
              name="address"
              rows={3}
              required
              minLength={10}
              maxLength={500}
              defaultValue={state.values?.address ?? ""}
              aria-invalid={Boolean(errorFor("address"))}
              aria-describedby={fieldDescribedBy("address", errorFor("address"), "address-hint")}
              className={inputClass}
            />
          </Field>

          <Field
            id="requirements"
            label="Product specifications / requirements (optional)"
            hint="Size, colour, or any special instruction for your selected product."
            error={errorFor("requirements")}
          >
            <textarea
              id="requirements"
              name="requirements"
              rows={3}
              maxLength={1000}
              defaultValue={state.values?.requirements ?? ""}
              aria-invalid={Boolean(errorFor("requirements"))}
              aria-describedby={fieldDescribedBy("requirements", errorFor("requirements"), "requirements-hint")}
              className={inputClass}
            />
          </Field>

          <Field id="notes" label="Order notes (optional)" error={errorFor("notes")}>
            <textarea
              id="notes"
              name="notes"
              rows={2}
              maxLength={2000}
              defaultValue={state.values?.notes ?? ""}
              aria-invalid={Boolean(errorFor("notes"))}
              aria-describedby={fieldDescribedBy("notes", errorFor("notes"))}
              className={inputClass}
            />
          </Field>
        </div>

        <fieldset className="mt-6 rounded-xl border border-[color:var(--border)] bg-[color:var(--background)] p-4">
          <legend className="px-1 text-sm font-semibold text-[color:var(--foreground)]">Payment method</legend>
          <label className="flex items-center gap-3 text-sm text-[color:var(--foreground)]">
            <input type="radio" name="paymentMethod" value="cod" checked readOnly className="accent-[color:var(--brand)]" />
            <span>
              Cash on Delivery (COD)
              <span className="block text-xs text-[color:var(--muted)]">Pay the delivery rider when your order arrives.</span>
            </span>
          </label>
        </fieldset>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button type="submit" className={primaryButtonClass} disabled={isPending}>
            {isPending ? "Submitting order…" : `Submit order · ${formatPkr(totals.total)}`}
          </button>
          <Link href="/cart" className={secondaryButtonClass}>
            Back to cart
          </Link>
        </div>
        <p className="mt-3 text-xs text-[color:var(--muted)]">
          Submitting does not confirm the order. Our admin team will contact you to verify it first.
        </p>
      </form>

      <aside aria-labelledby="checkout-summary" className="h-fit rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-6 shadow-sm lg:sticky lg:top-32">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="checkout-summary" className="text-lg font-semibold">
            Order summary
          </h2>
          <span className="text-xs text-[color:var(--muted)]">
            {count} {count === 1 ? "item" : "items"}
          </span>
        </div>

        <ul className="mt-4 divide-y divide-neutral-100">
          {items.map((item) => (
            <li key={item.variantId} className="flex gap-3 py-3">
              <div className="relative size-16 shrink-0 overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--background)]">
                <ProductImage
                  src={trustedCartImageUrl(item.display.imageUrl)}
                  alt={item.display.name}
                  sizes="64px"
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[color:var(--foreground)]">{item.display.name}</p>
                {item.display.attributesLabel ? (
                  <p className="truncate text-xs text-[color:var(--muted)]">{item.display.attributesLabel}</p>
                ) : null}
                <p className="mt-0.5 text-xs text-[color:var(--muted)]">Qty {item.quantity}</p>
              </div>
              <p className="text-sm font-semibold text-[color:var(--foreground)]">
                {formatPkr(BigInt(item.display.displayUnitPricePaisa) * BigInt(item.quantity))}
              </p>
            </li>
          ))}
        </ul>

        <dl className="mt-4 space-y-2 border-t border-[color:var(--border)] pt-4 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-[color:var(--muted)]">Subtotal</dt>
            <dd>{formatPkr(totals.subtotal)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-[color:var(--muted)]">Shipping</dt>
            <dd className="text-emerald-700">Free</dd>
          </div>
          <div className="flex justify-between gap-4 border-t border-[color:var(--border)] pt-3 text-base font-semibold">
            <dt>Estimated total</dt>
            <dd>{formatPkr(totals.total)}</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-[color:var(--muted)]">
          Estimated from your cart snapshot. The final total is recorded when the order is submitted.
        </p>
      </aside>
    </div>
  );
}
