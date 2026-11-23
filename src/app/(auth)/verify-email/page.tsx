import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { emailSchema } from "@/lib/validators";

import { VerifyEmailForm } from "./verify-email-form";

export const metadata: Metadata = {
  title: "Verify email · EveryNest",
  description: "Resend the email verification link for your EveryNest admin account.",
};

export const instant = false;

interface VerifyEmailPageProps {
  searchParams: Promise<{ email?: string; notice?: string }>;
}

export default async function VerifyEmailPage({ searchParams }: VerifyEmailPageProps) {
  await connection();

  const params = await searchParams;
  const user = await getCurrentUser();

  if (user?.email_confirmed_at) redirect("/admin");

  const email = emailSchema.safeParse(params.email ?? "");
  const initialEmail = email.success ? email.data : (user?.email ?? "");

  const notice =
    params.notice === "verify-required"
      ? "Confirm your email before opening the admin panel."
      : "Open the link in your inbox to confirm your address, or request a fresh one below.";

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Check your email</h1>
      <p className="mt-1.5 text-sm text-[color:var(--muted)]">
        Email verification keeps administrator access limited to the account owner.
      </p>

      <VerifyEmailForm initialEmail={initialEmail} notice={notice} />
    </>
  );
}
