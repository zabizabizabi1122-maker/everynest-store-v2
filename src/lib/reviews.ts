import { z } from "zod";

import { type FormActionState } from "@/lib/form-state";
import { uuidSchema } from "@/lib/validators";

/**
 * Level 11 — product review contract.
 *
 * The database is the authority: `public.submit_review` checks for a delivered
 * purchase, derives the author from auth.uid() and stores the review as pending.
 * These schemas validate the browser form on the server; no status or author is
 * ever accepted from the client.
 */

export const reviewSubmitSchema = z
  .object({
    productId: uuidSchema,
    rating: z.coerce.number().int().min(1).max(5),
    title: z.string().trim().min(2, "Add a short title.").max(120, "Title is too long."),
    body: z
      .string()
      .trim()
      .min(10, "Write at least 10 characters.")
      .max(2000, "Review is too long."),
  })
  .strict();

export type ReviewSubmitInput = z.infer<typeof reviewSubmitSchema>;

/** Shape returned by `public.submit_review`. */
// submit_review always returns 'pending'; a client cannot make it return an
// approved review, so the result schema only accepts that single status.
export const reviewResultSchema = z
  .object({
    id: uuidSchema,
    status: z.literal("pending"),
    productId: uuidSchema,
  })
  .strict();

export interface ReviewActionState extends FormActionState {
  submitted: boolean;
}

export const initialReviewState: ReviewActionState = {
  status: "idle",
  message: null,
  fieldErrors: {},
  values: {},
  submitted: false,
};

export type ReviewStatus = "pending" | "approved" | "rejected";

/** Public-facing label for a persisted review row. */
export interface PublicReview {
  id: string;
  authorLabel: string;
  rating: number;
  title: string;
  body: string;
  createdAt: string;
  isVerifiedPurchase: boolean;
}

export function reviewStatusLabel(status: ReviewStatus): string {
  switch (status) {
    case "pending":
      return "Pending review";
    case "approved":
      return "Approved";
    case "rejected":
      return "Rejected";
  }
}

/** Average rating rounded to one decimal place, or null when there are no reviews. */
export function averageRating(reviews: readonly { rating: number }[]): number | null {
  if (reviews.length === 0) return null;
  const total = reviews.reduce((sum, review) => sum + review.rating, 0);
  return Math.round((total / reviews.length) * 10) / 10;
}

/** Maps a trusted RPC error code to a safe customer-facing message. */
export function describeReviewError(code: string | null): string {
  switch (code) {
    case "P0002":
      return "You need a delivered order for this product before you can review it. Only one review per product is allowed.";
    case "42501":
      return "Please sign in to write a review.";
    case "22023":
      return "Please check your rating and review text.";
    case "23505":
      return "You have already reviewed this product.";
    default:
      return "Your review could not be submitted right now. Please try again.";
  }
}
