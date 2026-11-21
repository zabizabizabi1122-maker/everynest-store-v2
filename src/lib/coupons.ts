import { z } from "zod";

import { initialFormState, type FormActionState } from "@/lib/form-state";

/**
 * Level 11 — coupon contract.
 *
 * The database is the authority: `validate_coupon` reveals one active code's
 * public terms, and `place_order` recomputes the real paisa discount inside the
 * checkout transaction. Everything here is for display/validation only.
 */

const couponCodePattern = /^[A-Za-z0-9][A-Za-z0-9_-]{1,29}$/;
const decimalPaisaSchema = z.string().regex(/^[0-9]+$/, "Expected a non-negative integer amount.");

export const couponCodeSchema = z
  .string()
  .trim()
  .min(2, "Enter a coupon code.")
  .max(30, "Coupon codes are 30 characters or fewer.")
  .regex(couponCodePattern, "Use letters, numbers, hyphens or underscores.")
  .transform((value) => value.toUpperCase());

export const couponTermsSchema = z
  .object({
    code: z.string().regex(/^[A-Z0-9][A-Z0-9_-]{1,29}$/),
    description: z.string(),
    discountType: z.enum(["percent", "fixed_paisa"]),
    discountValue: decimalPaisaSchema,
    minSubtotalPaisa: decimalPaisaSchema,
  })
  .strict();

export type CouponTerms = z.infer<typeof couponTermsSchema>;

export interface CouponActionState extends FormActionState {
  code: string;
  terms: CouponTerms | null;
}

export const initialCouponState: CouponActionState = {
  ...initialFormState,
  code: "",
  terms: null,
};

/** Display-only estimate; the database may apply a different final amount. */
export function estimateCouponDiscountPaisa(subtotal: bigint, terms: CouponTerms): bigint {
  if (subtotal < BigInt(terms.minSubtotalPaisa)) return 0n;

  const value = BigInt(terms.discountValue);
  const discount =
    terms.discountType === "percent"
      ? (subtotal * value) / 100n
      : value < subtotal
        ? value
        : subtotal;

  return discount > subtotal ? subtotal : discount;
}

export function describeCouponTerms(terms: CouponTerms): string {
  return terms.discountType === "percent"
    ? `${terms.discountValue}% off`
    : `${terms.discountValue} paisa off`;
}

/** Admin create form contract. Values mirror the database checks. */
export const createCouponSchema = z
  .object({
    code: couponCodeSchema,
    description: z.string().trim().max(200, "Description is too long.").optional().default(""),
    discountType: z.enum(["percent", "fixed_paisa"]),
    discountValue: z.string().trim().regex(/^[0-9]+$/, "Enter a whole number."),
    minSubtotalPaisa: z.string().trim().regex(/^[0-9]+$/, "Enter a whole number.").optional().default("0"),
    maxUses: z.string().trim().max(10).optional().default(""),
    endsAt: z.string().trim().max(40).optional().default(""),
  })
  .superRefine((value, ctx) => {
    const amount = Number(value.discountValue);
    if (!Number.isSafeInteger(amount) || amount < 1) {
      ctx.addIssue({ code: "custom", path: ["discountValue"], message: "Enter a positive whole number." });
      return;
    }
    if (value.discountType === "percent" && amount > 100) {
      ctx.addIssue({ code: "custom", path: ["discountValue"], message: "Percent discount must be 1–100." });
    }
    if (value.discountType === "fixed_paisa" && amount > Number.MAX_SAFE_INTEGER) {
      ctx.addIssue({ code: "custom", path: ["discountValue"], message: "Amount is too large." });
    }
    if (value.maxUses !== "" && (!/^[0-9]+$/.test(value.maxUses) || Number(value.maxUses) < 1)) {
      ctx.addIssue({ code: "custom", path: ["maxUses"], message: "Use a positive whole number." });
    }
    if (value.endsAt !== "" && Number.isNaN(Date.parse(value.endsAt))) {
      ctx.addIssue({ code: "custom", path: ["endsAt"], message: "Enter a valid date." });
    }
  });
