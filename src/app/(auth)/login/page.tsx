import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { safeNextPath } from "@/lib/validators";

import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Log in · EveryNest",
  description: "Log in to your EveryNest account.",
};

// Reads the session cookie to skip the form for signed-in users.
export const instant = false;

interface LoginPageProps {
  searchParams: Promise<{ next?: string; error?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  await connection();

  const params = await searchParams;
  const nextPath = safeNextPath(params.next, "/account");

  // Already signed in: no reason to show the login form.
  const user = await getCurrentUser();
  if (user) redirect(nextPath);

  const notice =
    params.error === "link"
      ? "That confirmation link is invalid or has expired. Try logging in, or sign up again to receive a new link."
      : null;

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
      <p className="mt-1.5 text-sm text-[color:var(--muted)]">
        Log in to view your account and track your orders.
      </p>

      <LoginForm nextPath={nextPath} notice={notice} />

      <p className="mt-6 text-sm text-[color:var(--muted)]">
        New to EveryNest?{" "}
        <Link
          href={`/signup?next=${encodeURIComponent(nextPath)}`}
          className="font-semibold text-[color:var(--primary)] underline-offset-4 hover:underline"
        >
          Create an account
        </Link>
      </p>
    </>
  );
}
