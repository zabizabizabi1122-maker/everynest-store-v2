"use server";

import { requireUser } from "@/lib/auth";
import {
  couponCodeSchema,
  couponTermsSchema,
  initialCouponState,
  type CouponActionState,
} from "@/lib/coupons";
import { formString, toFieldErrors } from "@/lib/form-state";
import { createClient } from "@/lib/supabase/server";

/**
 * Checks a coupon code against the database before checkout.
 *
 * This is display-only: the authoritative discount is recomputed by
 * `public.place_order` from the coupon row inside the checkout transaction.
 */
export async function validateCouponAction(
  _previousState: CouponActionState,
  formData: FormData,
): Promise<CouponActionState> {
  await requireUser("/checkout");

  const parsed = couponCodeSchema.safeParse(formString(formData, "couponCode"));
  if (!parsed.success) {
    return {
      ...initialCouponState,
      status: "error",
      message: "Enter a valid coupon code.",
      fieldErrors: toFieldErrors(parsed.error),
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("validate_coupon", { p_code: parsed.data });

  if (error) {
    console.error("validate_coupon failed", error.code, error.message);
    return {
      ...initialCouponState,
      status: "error",
      message: "That code is invalid, expired or already used. Please check it and try again.",
      code: parsed.data,
    };
  }

  const terms = couponTermsSchema.safeParse(data);
  if (!terms.success) {
    console.error("validate_coupon returned an unexpected payload");
    return {
      ...initialCouponState,
      status: "error",
      message: "We could not check that code right now. Please try again.",
      code: parsed.data,
    };
  }

  return {
    status: "success",
    message: `Coupon ${terms.data.code} applied — ${terms.data.discountType === "percent" ? `${terms.data.discountValue}% off` : "fixed discount"}.`,
    fieldErrors: {},
    code: terms.data.code,
    terms: terms.data,
  };
}
