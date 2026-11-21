"use client";

import { useEffect } from "react";

/**
 * Error boundary for the admin area. Same rule as the customer pages: show a
 * friendly message and log only the digest, never profile or session data.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Admin page failed", error.digest ?? "");
  }, [error]);

  return (
    <div className="mx-auto w-full max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="mt-2 text-sm text-neutral-600">
        We could not load this admin page. No data was changed. Please try again.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 inline-flex items-center justify-center rounded-xl bg-[color:var(--brand)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[color:var(--brand)]/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--brand)]"
      >
        Try again
      </button>
    </div>
  );
}
