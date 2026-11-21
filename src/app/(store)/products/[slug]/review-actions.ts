"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth";
import { formString, toFieldErrors } from "@/lib/form-state";
import {
  describeReviewError,
  initialReviewState,
  reviewResultSchema,
  reviewSubmitSchema,
  type ReviewActionState,
} from "@/lib/reviews";
import { createClient } from "@/lib/supabase/server";

/**
 * Submits a product review through the trusted `public.submit_review` RPC.
 *
 * A purchase is required: the database checks for a delivered order line for
 * this product, derives the author from auth.uid() and stores the review as
 * pending. The form never supplies a status, author or order id.
 */
export async function submitReviewAction(
  _previousState: ReviewActionState,
  formData: FormData,
): Promise<ReviewActionState> {
  await requireUser("/account");

  const values = {
    productId: formString(formData, "productId"),
    rating: formString(formData, "rating"),
    title: formString(formData, "title"),
    body: formString(formData, "body"),
  };

  const parsed = reviewSubmitSchema.safeParse(values);
  if (!parsed.success) {
    return {
      ...initialReviewState,
      status: "error",
      message: "Please check the highlighted fields.",
      fieldErrors: toFieldErrors(parsed.error),
      values,
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_review", {
    p_product_id: parsed.data.productId,
    p_rating: parsed.data.rating,
    p_title: parsed.data.title,
    p_body: parsed.data.body,
  });

  if (error) {
    // Keep provider details on the server; return a safe, translated message.
    console.error("submit_review failed", error.code, error.message);
    return {
      ...initialReviewState,
      status: "error",
      message: describeReviewError(error.code),
      values,
    };
  }

  const result = reviewResultSchema.safeParse(data);
  if (!result.success) {
    console.error("submit_review returned an unexpected payload");
    return {
      ...initialReviewState,
      status: "error",
      message: "Your review could not be submitted right now. Please try again.",
      values,
    };
  }

  // Only approved reviews become public, so the storefront page is not stale
  // once a moderator approves this one.
  revalidatePath(`/products`);
  revalidatePath("/admin/reviews");

  return {
    status: "success",
    message: "Thank you. Your review was submitted and is awaiting approval.",
    fieldErrors: {},
    values: {},
    submitted: true,
  };
}
