"use client";

import { useActionState } from "react";

import {
  Field,
  FormMessage,
  fieldDescribedBy,
  inputClass,
  primaryButtonClass,
} from "@/components/ui/form";
import { initialReviewState } from "@/lib/reviews";

import { submitReviewAction } from "@/app/(store)/products/[slug]/review-actions";

/** Signed-in review form. The purchase requirement is enforced by the RPC. */
export function ReviewForm({ productId }: { productId: string }) {
  const [state, formAction, isPending] = useActionState(submitReviewAction, initialReviewState);
  const errorFor = (name: string) => state.fieldErrors[name]?.[0];

  if (state.submitted) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-800">
        Thank you for your review. It will appear on this page once our team approves it.
      </div>
    );
  }

  return (
    <form action={formAction} noValidate className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-6 shadow-sm">
      <h3 className="text-base font-semibold text-[color:var(--foreground)]">Write a review</h3>
      <p className="mt-1 text-xs text-[color:var(--muted)]">
        Only customers with a delivered order of this product can leave a review. New reviews are
        checked before they appear publicly.
      </p>

      <input type="hidden" name="productId" value={productId} />

      <div className="mt-5 grid gap-4">
        <FormMessage status={state.status} message={state.message} />

        <Field id="rating" label="Rating" error={errorFor("rating")}>
          <select
            id="rating"
            name="rating"
            className={inputClass}
            defaultValue="5"
            aria-invalid={Boolean(errorFor("rating"))}
            aria-describedby={fieldDescribedBy("rating", errorFor("rating"))}
          >
            <option value="5">5 — Excellent</option>
            <option value="4">4 — Good</option>
            <option value="3">3 — Average</option>
            <option value="2">2 — Fair</option>
            <option value="1">1 — Poor</option>
          </select>
        </Field>

        <Field id="reviewTitle" label="Title" error={errorFor("title")}>
          <input
            id="reviewTitle"
            name="title"
            required
            maxLength={120}
            placeholder="Sum up your experience"
            className={inputClass}
            defaultValue={state.values?.title ?? ""}
            aria-invalid={Boolean(errorFor("title"))}
            aria-describedby={fieldDescribedBy("reviewTitle", errorFor("title"))}
          />
        </Field>

        <Field id="reviewBody" label="Your review" error={errorFor("body")}>
          <textarea
            id="reviewBody"
            name="body"
            required
            rows={4}
            maxLength={2000}
            placeholder="What did you like or dislike? How was the quality and delivery?"
            className={inputClass}
            defaultValue={state.values?.body ?? ""}
            aria-invalid={Boolean(errorFor("body"))}
            aria-describedby={fieldDescribedBy("reviewBody", errorFor("body"))}
          />
        </Field>
      </div>

      <button type="submit" className={`${primaryButtonClass} mt-5`} disabled={isPending}>
        {isPending ? "Submitting…" : "Submit review"}
      </button>
    </form>
  );
}
