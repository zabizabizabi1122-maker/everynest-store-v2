"use client";

import { useEffect } from "react";

/**
 * Error boundary for `/account`.
 *
 * Shows a friendly message instead of a stack trace. The technical detail is
 * logged on the client only in development by Next.js; nothing internal is
 * rendered to the customer.
 */
export default function AccountError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Digest only: no emails, tokens or profile data in the console.
    console.error("Account page failed", error.digest ?? "");
  }, [error]);

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="mt-2 text-sm text-neutral-600">
        We could not load your account details. Your data is safe — please try again.
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
