import Link from "next/link";
import type { Metadata } from "next";
import { connection } from "next/server";

import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata: Metadata = {
  title: "Reset password · EveryNest",
  description: "Request a password reset link for your EveryNest admin account.",
};

// Reads request-bound configuration when sending the email, so this page is
// intentionally not eligible for an instant navigation.
export const instant = false;

export default async function ForgotPasswordPage() {
  await connection();

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Forgot password?</h1>
      <p className="mt-1.5 text-sm text-[color:var(--muted)]">
        Enter the email address for your admin account. We&apos;ll send a reset link if an account
        exists for it.
      </p>

      <ForgotPasswordForm />

      <p className="mt-6 text-center text-sm text-[color:var(--muted)]">
        <Link
          href="/login"
          className="font-medium text-[color:var(--primary)] transition hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--primary)]"
        >
          Back to sign in
        </Link>
      </p>
    </>
  );
}
