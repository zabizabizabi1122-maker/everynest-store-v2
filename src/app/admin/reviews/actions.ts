"use server";

import { revalidatePath } from "next/cache";

import { requireStaff } from "@/lib/auth";
import { type FormActionState, formString } from "@/lib/form-state";
import { uuidSchema } from "@/lib/validators";
import { createClient } from "@/lib/supabase/server";

/**
 * Approves or rejects a review.
 *
 * Staff access is checked from the database profile on every call. The status
 * change itself is delegated to `public.set_review_status`, which repeats the
 * staff check and only accepts the two moderation outcomes.
 */
export async function moderateReviewAction(
  _previousState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  await requireStaff("/admin/reviews");

  const id = uuidSchema.safeParse(formString(formData, "reviewId"));
  const status = formString(formData, "status");

  if (!id.success || (status !== "approved" && status !== "rejected")) {
    return {
      status: "error",
      message: "That moderation request was invalid.",
      fieldErrors: {},
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_review_status", {
    p_review_id: id.data,
    p_status: status,
  });

  if (error) {
    console.error("set_review_status failed", error.code, error.message);
    return {
      status: "error",
      message: "The review could not be updated. Please try again.",
      fieldErrors: {},
    };
  }

  // An approval changes what customers see on the product page.
  revalidatePath("/admin/reviews");
  revalidatePath("/products", "layout");

  return {
    status: "success",
    message: status === "approved" ? "Review approved and published." : "Review rejected.",
    fieldErrors: {},
  };
}
