import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { safeNextPath } from "@/lib/validators";

import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Admin sign in · EveryNest",
  description: "Sign in to the EveryNest admin panel.",
};

// Reads the session cookie to skip the form for signed-in users.
export const instant = false;

interface LoginPageProps {
  searchParams: Promise<{ next?: string; notice?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  await connection();

  const params = await searchParams;
  const nextPath = safeNextPath(params.next, "/admin");

  // Already signed in: no reason to show the login form.
  const user = await getCurrentUser();
  if (user) redirect(nextPath);

  const notice =
    params.notice === "reset-link-invalid"
      ? "That password reset link is invalid or has expired. Request a new one."
      : params.notice === "password-updated"
        ? "Your password has been updated. Sign in with your new password."
        : params.notice === "session-expired"
          ? "Your session expired or was closed. Please sign in again."
          : params.notice === "signed-out"
            ? "You have been signed out."
            : null;

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Admin sign in</h1>
      <p className="mt-1.5 text-sm text-[color:var(--muted)]">
        Sign in with a staff or administrator account to manage EveryNest.
      </p>

      <LoginForm nextPath={nextPath} notice={notice} />
    </>
  );
}
