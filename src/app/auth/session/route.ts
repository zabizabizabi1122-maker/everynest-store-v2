import { NextResponse, type NextRequest } from "next/server";

import { getAuthCookieOptions } from "@/lib/auth-security";
import { createClient } from "@/lib/supabase/server";

/**
 * Small session-status endpoint used by the invisible admin session monitor.
 *
 * It is NOT an authorization endpoint: admin pages and actions still call the
 * server guards. It only lets the browser notice an expired/invalid session
 * without waiting for the next navigation or rendering stale dashboard content.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ authenticated: false }, { headers: { "Cache-Control": "no-store" } });
    }

    // getSession() is used only to read the expiry timestamp for the timer.
    // Authorization above still comes from getUser().
    const {
      data: { session },
    } = await supabase.auth.getSession();

    return NextResponse.json(
      {
        authenticated: true,
        expiresAt: session?.expires_at ? session.expires_at * 1000 : null,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Session status check failed", error);
    return NextResponse.json({ authenticated: false }, { headers: { "Cache-Control": "no-store" } });
  }
}

/** Server-side logout used when the monitor detects an expired or invalid session. */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut({ scope: "global" });
  } catch (error) {
    console.error("Session cleanup sign-out failed", error);
  }

  const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  const clearOptions = { ...getAuthCookieOptions(), maxAge: 0 };

  request.cookies
    .getAll()
    .filter((cookie) => cookie.name.includes("-auth-token"))
    .forEach((cookie) => {
      response.cookies.set(cookie.name, "", clearOptions);
    });

  return response;
}
