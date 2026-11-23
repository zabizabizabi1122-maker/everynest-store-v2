import type { Metadata } from "next";
import Link from "next/link";

import { primaryButtonClass, secondaryButtonClass } from "@/components/ui/form";

export const metadata: Metadata = {
  title: "Verification link problem · EveryNest",
  description: "The email verification link could not be used.",
};

export default function VerificationFailedPage() {
  return (
    <>
      <div
        className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-amber-50 text-amber-600"
        aria-hidden="true"
      >
        <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth="2">
          <path d="M12 9v4m0 4h.01" strokeLinecap="round" strokeLinejoin="round" />
          <path
            d="M10.3 4.3 2.8 17.5A1.6 1.6 0 0 0 4.2 20h15.6a1.6 1.6 0 0 0 1.4-2.5L13.7 4.3a1.9 1.9 0 0 0-3.4 0Z"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      <h1 className="mt-4 text-2xl font-semibold tracking-tight">Link unavailable</h1>
      <p className="mt-1.5 text-sm text-[color:var(--muted)]">
        This verification link is invalid, has expired, or has already been used. Request a fresh
        link and we&apos;ll send it to your email if the account still needs confirmation.
      </p>

      <div className="mt-6 space-y-3">
        <Link href="/verify-email" className={`${primaryButtonClass} w-full`}>
          Request a new link
        </Link>
        <Link href="/login" className={`${secondaryButtonClass} w-full`}>
          Back to sign in
        </Link>
      </div>
    </>
  );
}
