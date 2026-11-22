import { averageRating, type PublicReview } from "@/lib/reviews";

function formattedDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-PK", { dateStyle: "medium" }).format(date);
}

function Stars({ rating }: { rating: number }) {
  const rounded = Math.round(rating);
  return (
    <span aria-label={`${rating} out of 5 stars`} className="text-amber-600">
      <span aria-hidden="true">{"★".repeat(rounded)}</span>
      <span className="text-neutral-300" aria-hidden="true">{"★".repeat(5 - rounded)}</span>
    </span>
  );
}

/**
 * Public review list. Only approved rows reach this component (RLS is the real
 * boundary); the page also loads with an explicit `status = approved` filter.
 */
export function ProductReviews({ reviews }: { reviews: PublicReview[] }) {
  const average = averageRating(reviews);

  return (
    <section aria-labelledby="reviews-heading" className="mt-16">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="reviews-heading" className="text-2xl font-semibold tracking-tight">
            Customer reviews
          </h2>
          <p className="mt-1 text-sm text-[color:var(--muted)]">
            {reviews.length === 0
              ? "No reviews yet — be the first to share your experience."
              : `${reviews.length} approved ${reviews.length === 1 ? "review" : "reviews"}`}
          </p>
        </div>
        {average !== null ? (
          <div className="flex items-center gap-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 shadow-sm">
            <span className="text-2xl font-bold text-[color:var(--foreground)]">{average.toFixed(1)}</span>
            <div>
              <Stars rating={average} />
              <span className="block text-xs text-[color:var(--muted)]">out of 5</span>
            </div>
          </div>
        ) : null}
      </div>

      {reviews.length > 0 ? (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          {reviews.map((review) => (
            <li key={review.id} className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Stars rating={review.rating} />
                <span className="text-xs text-[color:var(--muted)]">{formattedDate(review.createdAt)}</span>
              </div>
              <h3 className="mt-3 font-semibold text-[color:var(--foreground)]">{review.title}</h3>
              <p className="mt-2 whitespace-pre-line text-sm leading-6 text-[color:var(--muted)]">{review.body}</p>
              <p className="mt-4 text-xs text-[color:var(--muted)]">
                <span className="font-medium text-[color:var(--foreground)]">{review.authorLabel}</span>
                {review.isVerifiedPurchase ? (
                  <span className="ml-2 inline-flex rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700">
                    Verified purchase
                  </span>
                ) : null}
              </p>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
