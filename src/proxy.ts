import { NextResponse, type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/proxy";

/**
 * Next.js 16 proxy convention (replaces `middleware.ts`).
 *
 * Two responsibilities only:
 *  1. refresh the Supabase session cookies on protected/auth routes;
 *  2. preliminary redirects for a nicer flow.
 *
 * This is NOT the authorization layer. `/admin` checks the caller's role on the
 * server, and PostgreSQL enforces RLS and column privileges regardless.
 */
export async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const { pathname, search } = request.nextUrl;

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
    const next = encodeURIComponent(`${pathname}${search}`);
    return redirectTo(`/login?next=${next}`);
  }

  if (user && pathname === "/login") {
    return redirectTo("/admin");
  }

  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/login"],
};
