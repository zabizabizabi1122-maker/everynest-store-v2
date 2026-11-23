import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { connection } from "next/server";

import { getCurrentUser } from "@/lib/auth";

import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = {
  title: "Choose a new password · EveryNest",
  description: "Set a new password for your EveryNest admin account.",
};

// The session is verified on the server before the form is rendered.
export const instant = false;

export default async function ResetPasswordPage() {
  await connection();

  const user = await getCurrentUser();
  if (!user) redirect("/login?notice=reset-link-invalid");

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Choose a new password</h1>
      <p className="mt-1.5 text-sm text-[color:var(--muted)]">
        Enter and confirm a new password for your admin account.
      </p>

      <ResetPasswordForm />
    </>
  );
}
