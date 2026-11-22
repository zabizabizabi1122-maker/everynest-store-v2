"use client";

import { useActionState } from "react";

import { toggleWishlistAction } from "@/app/(store)/wishlist/actions";
import { initialWishlistState, type WishlistActionState } from "@/lib/wishlist";

/**
 * Save/remove toggle for a product. The server decides the new state from RLS;
 * the initial value only controls the first label the visitor sees.
 * `compact` renders the heart-only variant used on product cards.
 */
export function WishlistToggle({
  productId,
  initialSaved = false,
  compact = false,
}: {
  productId: string;
  initialSaved?: boolean;
  compact?: boolean;
}) {
  const initial: WishlistActionState = { ...initialWishlistState, saved: initialSaved };
  const [state, formAction, isPending] = useActionState(toggleWishlistAction, initial);
  const saved = state.saved;
  const label = saved ? "Remove from wishlist" : "Save to wishlist";

  const className = compact
    ? `grid size-9 place-items-center rounded-full border bg-[color:var(--surface)]/95 shadow-sm backdrop-blur transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--primary)] disabled:cursor-not-allowed disabled:opacity-60 ${
        saved
          ? "border-rose-300 text-rose-600"
          : "border-[color:var(--border)] text-foreground hover:text-[color:var(--accent)]"
      }`
    : `inline-flex items-center gap-2 rounded-[10px] border px-4 py-2.5 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--primary)] disabled:cursor-not-allowed disabled:opacity-60 ${
        saved
          ? "border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100"
          : "border-[color:var(--border)] bg-[color:var(--surface)] text-foreground hover:bg-[color:var(--background)]"
      }`;

  return (
    <form action={formAction} className="inline-block">
      <input type="hidden" name="productId" value={productId} />
      <button
        type="submit"
        disabled={isPending}
        aria-pressed={saved}
        aria-label={compact ? label : undefined}
        title={label}
        className={className}
      >
        <svg
          viewBox="0 0 24 24"
          fill={saved ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="1.6"
          aria-hidden="true"
          className="size-5"
        >
          <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" />
        </svg>
        {compact ? null : isPending ? "Saving…" : saved ? "Saved" : "Save"}
      </button>
      {state.status === "error" && state.message ? (
        <span role="alert" className="mt-1.5 block text-xs text-red-600">
          {state.message}
        </span>
      ) : null}
    </form>
  );
}
