import { NextResponse, type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/proxy";

/**
 * Next.js 16 proxy convention (replaces `middleware.ts`).
 *
 * Three small responsibilities:
 *  1. refresh the Supabase session cookies on protected/auth routes;
 *  2. reject cross-origin writes on matched auth/admin routes;
 *  3. preliminary redirects for a nicer flow.
 *
 * This is NOT the authorization layer. `/admin` checks the caller's role on the
 * server, and PostgreSQL enforces RLS and column privileges regardless.
 */
export async function proxy(request: NextRequest) {
  const { response, user, sessionInvalid } = await updateSession(request);
  const { pathname, search } = request.nextUrl;

  // Next.js Server Actions already check Origin/Host. This explicit check also
  // covers any future Route Handler under the matched admin/auth paths.
  if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) {
    const origin = request.headers.get("origin");
    if (origin) {
      const expectedHost = request.headers.get("x-forwarded-host") ?? request.nextUrl.host;
      let originHost = "";
      try {
        originHost = new URL(origin).host;
      } catch {
        originHost = "";
      }

      if (!originHost || originHost !== expectedHost) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }
  }

  const redirectTo = (target: string) => {
    const url = request.nextUrl.clone();
    const [path, query] = target.split("?");
    url.pathname = path;
    url.search = query ? `?${query}` : "";

    const redirect = NextResponse.redirect(url);

    // Preserve refreshed auth cookies on the redirect response.
    response.cookies.getAll().forEach((cookie) => {
      redirect.cookies.set(cookie);
    });

    return redirect;
  };

  // Preliminary protection only: send signed-out visitors to login. The role
  // for `/admin` is checked later, on the server, against the database.
  const requiresSignIn = pathname.startsWith("/admin");

  if (!user && requiresSignIn) {
    if (sessionInvalid) {
      return redirectTo("/login?notice=session-expired");
    }

    const next = encodeURIComponent(`${pathname}${search}`);
    return redirectTo(`/login?next=${next}`);
  }

  if (user && pathname === "/login") {
    return redirectTo("/admin");
  }

  return response;
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/login",
    "/forgot-password",
    "/reset-password",
    "/verify-email",
    "/verification-success",
    "/verification-failed",
    "/auth/callback",
    "/auth/session",
  ],
};
