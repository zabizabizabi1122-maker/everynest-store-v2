import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { primaryButtonClass } from "@/components/ui/form";

export const metadata: Metadata = {
  title: "Email verified · EveryNest",
  description: "Your EveryNest admin email was verified successfully.",
};

export const instant = false;

export default async function VerificationSuccessPage() {
  await connection();

  const user = await getCurrentUser();
  if (user?.email_confirmed_at) redirect("/admin");

  return (
    <>
      <div
        className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"
        aria-hidden="true"
      >
        <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth="2">
          <path d="m5 13 4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      <h1 className="mt-4 text-2xl font-semibold tracking-tight">Email verified</h1>
      <p className="mt-1.5 text-sm text-[color:var(--muted)]">
        Your address is confirmed. You can now sign in to the admin panel.
      </p>

      <Link href="/login" className={`${primaryButtonClass} mt-6 w-full`}>
        Continue to sign in
      </Link>
    </>
  );
}
