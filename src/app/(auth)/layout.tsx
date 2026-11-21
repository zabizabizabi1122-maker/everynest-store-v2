import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Layout for the authentication screens (login / signup).
 *
 * Kept intentionally minimal so the form is the focus. The storefront header is
 * not reused here to avoid offering cart/account links to a signed-out visitor.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-neutral-50">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-6">
        <Link
          href="/"
          className="text-sm font-semibold uppercase tracking-[0.2em] text-[color:var(--brand)]"
        >
          EveryNest
        </Link>
        <Link
          href="/"
          className="rounded-lg px-2 py-1 text-sm text-neutral-600 transition hover:text-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--brand)]"
        >
          Back to store
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 pb-16">
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
