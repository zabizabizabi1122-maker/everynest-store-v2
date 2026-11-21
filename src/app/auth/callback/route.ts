import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/validators";

/**
 * Email-confirmation callback.
 *
 * Supabase sends the confirmation link here with a PKCE `code`. The code is
 * exchanged server-side for a session, which is written to httpOnly cookies.
 * The `next` parameter is validated so it cannot become an open redirect.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const nextPath = safeNextPath(searchParams.get("next"));

  const backToLogin = () =>
    NextResponse.redirect(new URL("/login?error=link", origin));

  if (!code) return backToLogin();

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) return backToLogin();

  return NextResponse.redirect(new URL(nextPath, origin));
}
