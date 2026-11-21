"use client";

import { useActionState, useEffect } from "react";

import {
  FormMessage,
  fieldDescribedBy,
  inputClass,
  secondaryButtonClass,
} from "@/components/ui/form";
import { describeCouponTerms, initialCouponState, type CouponTerms } from "@/lib/coupons";

import { validateCouponAction } from "@/app/(store)/checkout/coupon-actions";

interface CouponFieldProps {
  onValidated: (coupon: { code: string; terms: CouponTerms } | null) => void;
}

/**
 * Standalone coupon checker. It lives in its own form so it can validate a code
 * without submitting the order; the confirmed code is forwarded to checkout
 * through a hidden input owned by the parent form.
 */
export function CouponField({ onValidated }: CouponFieldProps) {
  const [state, formAction, isPending] = useActionState(validateCouponAction, initialCouponState);

  useEffect(() => {
    onValidated(state.status === "success" && state.terms ? { code: state.code, terms: state.terms } : null);
  }, [state, onValidated]);

  const error = state.fieldErrors.couponCode?.[0];

  return (
    <form action={formAction} noValidate className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
      <label htmlFor="couponCode" className="block text-xs font-semibold uppercase tracking-wide text-neutral-600">
        Discount code
      </label>
      <div className="mt-2 flex gap-2">
        <input
          id="couponCode"
          name="couponCode"
          type="text"
          autoComplete="off"
          maxLength={30}
          placeholder="e.g. SAVE10"
          aria-invalid={Boolean(error)}
          aria-describedby={fieldDescribedBy("couponCode", error)}
          className={`${inputClass} mt-0 uppercase`}
        />
        <button type="submit" className={secondaryButtonClass} disabled={isPending}>
          {isPending ? "Checking…" : "Check"}
        </button>
      </div>
      {error ? (
        <p id="couponCode-error" className="mt-1.5 text-xs text-red-600">
          {error}
        </p>
      ) : null}
      <FormMessage status={state.status} message={state.message} />
      {state.terms ? (
        <p className="mt-1 text-xs text-emerald-700">
          {describeCouponTerms(state.terms)} · minimum spend applies
        </p>
      ) : null}
    </form>
  );
}
