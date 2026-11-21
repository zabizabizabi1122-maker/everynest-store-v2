"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";

import { CouponField } from "@/components/store/coupon-field";
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
import { estimateCouponDiscountPaisa, type CouponTerms } from "@/lib/coupons";
import { formatPkr } from "@/lib/money";

import { placeOrderAction } from "./actions";

interface CheckoutFormProps {
  defaultFullName: string;
  defaultPhone: string;
  defaultCity?: string;
  defaultAddress?: string;
}

/**
 * COD checkout form. Cart contents are rendered from the non-authoritative
 * client store; only variant ids and quantities are submitted. The Server
 * Action revalidates every line in `public.place_order`.
 */
export function CheckoutForm({
  defaultFullName,
  defaultPhone,
  defaultCity = "",
  defaultAddress = "",
}: CheckoutFormProps) {
  const { items, count, clear } = useCart();
  const [state, formAction, isPending] = useActionState(placeOrderAction, initialCheckoutState);
  const [coupon, setCoupon] = useState<{ code: string; terms: CouponTerms } | null>(null);
  const keyInput = useRef<HTMLInputElement>(null);
  const itemsInput = useRef<HTMLInputElement>(null);
  const clearedOrder = useRef<string | null>(null);

  const totals = estimateCheckoutTotals(items);
  const couponDiscount = coupon ? estimateCouponDiscountPaisa(totals.subtotal, coupon.terms) : 0n;
  const estimatedTotal = totals.total - couponDiscount;
  const orderId = state.order?.id ?? null;

  useEffect(() => {
    if (!orderId || clearedOrder.current === orderId) return;

    // A confirmed order leaves the cart; a retry must use a fresh key.
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
    return (
      <section
        aria-labelledby="order-confirmed"
        className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center shadow-sm"
      >
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="size-6">
            <path d="m5 13 4 4L19 7" />
          </svg>
        </span>
        <h2 id="order-confirmed" className="mt-4 text-xl font-semibold text-emerald-900">
          Order confirmed
        </h2>
        <p className="mt-2 text-sm text-emerald-800">{state.message}</p>
        <dl className="mx-auto mt-5 max-w-sm divide-y divide-emerald-200 text-sm">
          <div className="flex items-center justify-between gap-4 py-2">
            <dt className="text-emerald-800">Order number</dt>
            <dd className="font-semibold text-emerald-900">{state.order.orderNumber}</dd>
          </div>
          <div className="flex items-center justify-between gap-4 py-2">
            <dt className="text-emerald-800">Total</dt>
            <dd className="font-semibold text-emerald-900">
              {formatDecimalPaisa(state.order.totalPaisa)}
            </dd>
          </div>
        </dl>
        <p className="mt-4 text-xs text-emerald-800">
          Keep this number for your records. Payment is collected on delivery.
        </p>
        <Link href="/products" className={`${primaryButtonClass} mt-6`}>
          Continue shopping
        </Link>
      </section>
    );
  }

  if (items.length === 0) {
    return (
      <section className="rounded-2xl border border-neutral-200 bg-white p-8 text-center shadow-sm">
        <h2 className="text-lg font-semibold">Your cart is empty</h2>
        <p className="mt-2 text-sm text-neutral-600">
          Add a product to your cart before checking out.
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
        className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm"
      >
        <input ref={keyInput} type="hidden" name="idempotencyKey" defaultValue="" />
        <input ref={itemsInput} type="hidden" name="items" defaultValue="[]" />
        <input type="hidden" name="couponCode" value={coupon?.code ?? ""} />

        <h2 className="text-lg font-semibold">Delivery details</h2>
        <p className="mt-1 text-sm text-neutral-600">
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
              defaultValue={state.values?.customerName ?? defaultFullName}
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
              defaultValue={state.values?.phone ?? defaultPhone}
              aria-invalid={Boolean(errorFor("phone"))}
              aria-describedby={fieldDescribedBy("phone", errorFor("phone"), "phone-hint")}
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
              defaultValue={state.values?.city ?? defaultCity}
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
              defaultValue={state.values?.address ?? defaultAddress}
              aria-invalid={Boolean(errorFor("address"))}
              aria-describedby={fieldDescribedBy("address", errorFor("address"), "address-hint")}
              className={inputClass}
            />
          </Field>
        </div>

        <fieldset className="mt-6 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
          <legend className="px-1 text-sm font-semibold text-neutral-800">Payment method</legend>
          <label className="flex items-center gap-3 text-sm text-neutral-800">
            <input type="radio" name="paymentMethod" value="cod" checked readOnly className="accent-[color:var(--brand)]" />
            <span>
              Cash on Delivery (COD)
              <span className="block text-xs text-neutral-500">Pay the delivery rider when your order arrives.</span>
            </span>
          </label>
        </fieldset>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button type="submit" className={primaryButtonClass} disabled={isPending}>
            {isPending ? "Placing order…" : `Place order · ${formatPkr(estimatedTotal)}`}
          </button>
          <Link href="/cart" className={secondaryButtonClass}>
            Back to cart
          </Link>
        </div>
        <p className="mt-3 text-xs text-neutral-500">
          Final prices and stock are confirmed when the order is placed. No payment is taken online.
        </p>
      </form>

      <aside aria-labelledby="checkout-summary" className="h-fit rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm lg:sticky lg:top-32">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="checkout-summary" className="text-lg font-semibold">
            Order summary
          </h2>
          <span className="text-xs text-neutral-500">
            {count} {count === 1 ? "item" : "items"}
          </span>
        </div>

        <div className="mt-4">
          <CouponField onValidated={setCoupon} />
        </div>

        <ul className="mt-4 divide-y divide-neutral-100">
          {items.map((item) => (
            <li key={item.variantId} className="flex gap-3 py-3">
              <div className="relative size-16 shrink-0 overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50">
                <ProductImage
                  src={trustedCartImageUrl(item.display.imageUrl)}
                  alt={item.display.name}
                  sizes="64px"
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-neutral-900">{item.display.name}</p>
                {item.display.attributesLabel ? (
                  <p className="truncate text-xs text-neutral-500">{item.display.attributesLabel}</p>
                ) : null}
                <p className="mt-0.5 text-xs text-neutral-500">Qty {item.quantity}</p>
              </div>
              <p className="text-sm font-semibold text-neutral-900">
                {formatPkr(BigInt(item.display.displayUnitPricePaisa) * BigInt(item.quantity))}
              </p>
            </li>
          ))}
        </ul>

        <dl className="mt-4 space-y-2 border-t border-neutral-200 pt-4 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-neutral-600">Subtotal</dt>
            <dd>{formatPkr(totals.subtotal)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-neutral-600">Shipping</dt>
            <dd className="text-emerald-700">Free</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-neutral-600">Discount</dt>
            <dd className={couponDiscount > 0n ? "text-emerald-700" : undefined}>
              {coupon && couponDiscount > 0n ? `− ${formatPkr(couponDiscount)}` : formatPkr(0n)}
            </dd>
          </div>
          <div className="flex justify-between gap-4 border-t border-neutral-200 pt-3 text-base font-semibold">
            <dt>Estimated total</dt>
            <dd>{formatPkr(estimatedTotal)}</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-neutral-500">
          Estimated from your cart snapshot. The confirmed total appears after you place the order.
        </p>
      </aside>
    </div>
  );
}
