import type { Metadata } from "next";
import { connection } from "next/server";

import { ReviewModerationForm } from "@/components/admin/review-moderation-form";
import { requirePermission } from "@/lib/auth";
import { reviewStatusLabel, type ReviewStatus } from "@/lib/reviews";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Reviews · EveryNest Admin",
};

export const instant = false;

interface ReviewsPageProps {
  searchParams: Promise<{ status?: string }>;
}

const STATUS_FILTERS: readonly { value: string; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "all", label: "All" },
];

function isReviewStatus(value: string): value is ReviewStatus {
  return value === "pending" || value === "approved" || value === "rejected";
}

function formattedDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-PK", { dateStyle: "medium" }).format(date);
}

export default async function AdminReviewsPage({ searchParams }: ReviewsPageProps) {
  // Supabase's token-expiry check reads Date.now(); mark this page
  // request-bound before that read so Next.js does not prerender it.
  await connection();

  await requirePermission("reviews.view", "/admin/reviews");

  const params = await searchParams;
  const requestedStatus = params.status ?? "";
  const filter: ReviewStatus | "all" =
    requestedStatus === "all"
      ? "all"
      : isReviewStatus(requestedStatus)
        ? requestedStatus
        : "pending";

  const supabase = await createClient();
  let query = supabase
    .from("reviews")
    .select("id, product_id, author_label, rating, title, body, status, is_verified_purchase, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (filter !== "all") query = query.eq("status", filter);

  const { data: reviews, error } = await query;

  // Resolve product names in one bounded query; no client-side table access.
  const productIds = [...new Set((reviews ?? []).map((review) => review.product_id))];
  const { data: products } = productIds.length
    ? await supabase.from("products").select("id, name").in("id", productIds)
    : { data: [] };
  const productNames = new Map((products ?? []).map((product) => [product.id, product.name]));

  return (
    <div>
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--brand)]">
          Level 11 · Optional features
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Product reviews</h1>
        <p className="mt-1.5 text-sm text-neutral-600">
          Reviews come from verified, delivered purchases. Approve or reject them here; only
          approved reviews are visible to customers.
        </p>
      </header>

      <nav aria-label="Filter reviews" className="mt-6 flex flex-wrap gap-2">
        {STATUS_FILTERS.map((item) => (
          <a
            key={item.value}
            href={`/admin/reviews?status=${item.value}`}
            aria-current={filter === item.value ? "page" : undefined}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
              filter === item.value
                ? "bg-[color:var(--brand)] text-white"
                : "border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
            }`}
          >
            {item.label}
          </a>
        ))}
      </nav>

      <section className="mt-6 space-y-4">
        {error ? (
          <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            Reviews could not be loaded right now.
          </p>
        ) : !reviews || reviews.length === 0 ? (
          <p className="rounded-2xl border border-neutral-200 bg-white p-6 text-sm text-neutral-600">
            No {filter === "all" ? "" : `${filter} `}reviews to show.
          </p>
        ) : (
          reviews.map((review) => {
            const status: ReviewStatus = isReviewStatus(review.status) ? review.status : "pending";
            return (
              <article
                key={review.id}
                className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--brand)]">
                      {productNames.get(review.product_id) ?? "Product"}
                    </p>
                    <h2 className="mt-1 text-base font-semibold text-neutral-900">{review.title}</h2>
                    <p className="mt-0.5 text-xs text-neutral-500">
                      {review.author_label} · {review.rating}/5 · {formattedDate(review.created_at)}
                      {review.is_verified_purchase ? " · Verified purchase" : ""}
                    </p>
                  </div>
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                      status === "approved"
                        ? "bg-emerald-50 text-emerald-700"
                        : status === "pending"
                          ? "bg-amber-50 text-amber-700"
                          : "bg-neutral-100 text-neutral-600"
                    }`}
                  >
                    {reviewStatusLabel(status)}
                  </span>
                </div>
                <p className="mt-3 whitespace-pre-line text-sm leading-6 text-neutral-600">{review.body}</p>

                {status === "pending" ? <ReviewModerationForm reviewId={review.id} /> : null}
              </article>
            );
          })
        )}
      </section>
    </div>
  );
}
