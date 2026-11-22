import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { safeNextPath } from "@/lib/validators";

import { SignupForm } from "./signup-form";

export const metadata: Metadata = {
  title: "Create account · EveryNest",
  description: "Create your EveryNest account to place and track orders.",
};

// Reads the session cookie to skip the form for signed-in users.
export const instant = false;

interface SignupPageProps {
  searchParams: Promise<{ next?: string }>;
}

export default async function SignupPage({ searchParams }: SignupPageProps) {
  await connection();

  const params = await searchParams;
  const nextPath = safeNextPath(params.next, "/account");

  const user = await getCurrentUser();
  if (user) redirect(nextPath);

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
      <p className="mt-1.5 text-sm text-[color:var(--muted)]">
        It takes less than a minute. You can change your name and phone number later.
      </p>

      <SignupForm nextPath={nextPath} />

      <p className="mt-6 text-sm text-[color:var(--muted)]">
        Already have an account?{" "}
        <Link
          href={`/login?next=${encodeURIComponent(nextPath)}`}
          className="font-semibold text-[color:var(--primary)] underline-offset-4 hover:underline"
        >
          Log in
        </Link>
      </p>
    </>
  );
}
