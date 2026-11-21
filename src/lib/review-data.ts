import { cache } from "react";

import { getCurrentUser } from "@/lib/auth";
import { type PublicReview } from "@/lib/reviews";
import { createClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validators";

/** Maximum number of public reviews shown on a product page. */
export const PRODUCT_REVIEW_LIMIT = 50;

/**
 * Loads approved reviews for one product.
 *
 * The query uses the published/anon key for visitors and the signed-in key for
 * customers. Either way RLS only exposes `status = 'approved'` rows to a
 * customer; the explicit filter is defence in depth and keeps the intent clear.
 */
export const loadApprovedReviews = cache(
  async (productId: string): Promise<PublicReview[]> => {
    if (!uuidSchema.safeParse(productId).success) return [];

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("reviews")
      .select("id, author_label, rating, title, body, created_at, is_verified_purchase")
      .eq("product_id", productId)
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(PRODUCT_REVIEW_LIMIT);

    if (error) {
      console.error("review list failed", error.code, error.message);
      return [];
    }

    return (data ?? []).map((review) => ({
      id: review.id,
      authorLabel: review.author_label,
      rating: review.rating,
      title: review.title,
      body: review.body,
      createdAt: review.created_at,
      isVerifiedPurchase: review.is_verified_purchase,
    }));
  },
);

/** Whether the current visitor is signed in (used to decide if the form shows). */
export async function isSignedIn(): Promise<boolean> {
  return (await getCurrentUser()) !== null;
}
