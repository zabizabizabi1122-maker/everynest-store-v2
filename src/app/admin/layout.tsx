import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense, type ReactNode } from "react";

import { AdminShell } from "@/components/admin/admin-shell";
import { requireStaff } from "@/lib/auth";

export const metadata: Metadata = {
  title: { default: "Admin · EveryNest", template: "%s · Admin · EveryNest" },
  description: "EveryNest admin panel.",
  // Admin pages must never appear in search results.
  robots: { index: false, follow: false },
};

/**
 * Keeps navigation validation off this segment. The request-time work below is
 * handled by the Suspense boundary, not by this flag.
 */
export const instant = false;

/**
 * Static shell shown while the verified staff session streams in. It must stay
 * deterministic: no cookies, clock, or random values here.
 */
function AdminShellFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-6">
      <p className="text-sm font-medium text-neutral-500">Loading admin panel…</p>
    </div>
  );
}

/**
 * The real authorization gate. It runs only at request time: `connection()`
 * marks the component request-bound, and the parent Suspense boundary keeps it
 * (and every admin child) out of the prerendered shell.
 *
 * Supabase validates the access token with `Date.now()` internally, so letting
 * this run during prerender is what triggered Next.js's unstable-value error.
 * `requireStaff()` still verifies the session with `auth.getUser()` and reads
 * the role from `public.profiles` on every request — never from a cookie or
 * client input.
 */
async function StaffArea({ children }: { children: ReactNode }) {
  await connection();

  const { user, profile } = await requireStaff();

  return (
    <AdminShell userEmail={user.email ?? "signed-in user"} role={profile.role}>
      {children}
    </AdminShell>
  );
}

/**
 * Admin route-group layout.
 *
 * The synchronous wrapper renders a small static fallback instantly; the
 * session-aware shell and all admin pages stream in behind the boundary. The
 * proxy redirect is only a convenience — `requireStaff()` above is the real
 * gate for this whole segment.
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<AdminShellFallback />}>
      <StaffArea>{children}</StaffArea>
    </Suspense>
  );
}
