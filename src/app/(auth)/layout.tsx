import Link from "next/link";
import type { ReactNode } from "react";

import { secondaryButtonClass } from "@/components/ui/form";

/**
 * Layout for the administrator sign-in screen.
 *
 * Kept intentionally minimal so the form is the focus. The storefront header is
 * not reused here to avoid offering cart links to a signed-out visitor.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-[color:var(--background)]">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-6">
        <Link
          href="/"
          className="text-sm font-semibold uppercase tracking-[0.2em] text-[color:var(--primary)]"
        >
          EveryNest Admin
        </Link>
        <Link href="/" className={`${secondaryButtonClass} gap-2`} aria-label="View the EveryNest website">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="size-4"
          >
            <path d="M14 5h5v5M19 5l-7 7M18 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
          </svg>
          View website
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 pb-16">
        <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-6 shadow-sm sm:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
