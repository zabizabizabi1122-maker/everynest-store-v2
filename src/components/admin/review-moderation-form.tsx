"use client";

import { useActionState } from "react";

import { FormMessage, primaryButtonClass, secondaryButtonClass } from "@/components/ui/form";
import { initialFormState } from "@/lib/form-state";

import { moderateReviewAction } from "@/app/admin/reviews/actions";

/** Approve/reject controls for one pending review. */
export function ReviewModerationForm({ reviewId }: { reviewId: string }) {
  const [state, formAction, isPending] = useActionState(
    moderateReviewAction,
    initialFormState,
  );

  return (
    <form action={formAction} className="mt-3">
      <input type="hidden" name="reviewId" value={reviewId} />
      <FormMessage status={state.status} message={state.message} />
      <div className="mt-2 flex gap-2">
        <button
          type="submit"
          name="status"
          value="approved"
          disabled={isPending}
          className={`${primaryButtonClass} px-3 py-1.5 text-xs`}
        >
          {isPending ? "Saving…" : "Approve"}
        </button>
        <button
          type="submit"
          name="status"
          value="rejected"
          disabled={isPending}
          className={`${secondaryButtonClass} px-3 py-1.5 text-xs`}
        >
          {isPending ? "Saving…" : "Reject"}
        </button>
      </div>
    </form>
  );
}
