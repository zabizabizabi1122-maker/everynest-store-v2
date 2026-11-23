import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { canAccessAdmin } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/validators";

/**
 * Shared Supabase Auth callback for email verification and password recovery.
 *
 * Supabase appends a single-use PKCE `code` to the redirect URL. Exchanging it
 * verifies the link and writes the resulting session to HTTP-only cookies. We
 * then re-check the user with `getUser()` before deciding where to send them.
 */
const callbackQuerySchema = z.object({
  code: z.string().min(1),
  next: z.string().optional(),
  type: z.enum(["verification", "recovery"]).optional(),
});

type LinkType = "verification" | "recovery";

function failureRedirect(request: NextRequest, type: LinkType) {
  const target =
    type === "verification"
      ? "/verification-failed"
      : "/login?notice=reset-link-invalid";

  return NextResponse.redirect(new URL(target, request.url));
}

export async function GET(request: NextRequest) {
  const rawType = request.nextUrl.searchParams.get("type");
  const parsed = callbackQuerySchema.safeParse({
    code: request.nextUrl.searchParams.get("code") ?? undefined,
    next: request.nextUrl.searchParams.get("next") ?? undefined,
    type: rawType === "verification" || rawType === "recovery" ? rawType : undefined,
  });

  // Old recovery emails didn't include `type`; infer it from their target.
  const linkType: LinkType =
    parsed.success && parsed.data.type
      ? parsed.data.type
      : (request.nextUrl.searchParams.get("next") ?? "").includes("reset-password")
        ? "recovery"
        : "verification";

  if (!parsed.success) return failureRedirect(request, linkType);

  try {
    const supabase = await createClient();
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(parsed.data.code);

    if (exchangeError) {
      console.error("Auth callback code exchange failed", exchangeError.message);
      return failureRedirect(request, linkType);
    }

    // getUser() contacts Supabase Auth. Never trust the exchanged session alone.
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error("Auth callback user check failed", userError?.message ?? "No user returned");
      return failureRedirect(request, linkType);
    }

    if (linkType === "verification") {
      if (!user.email_confirmed_at) {
        return failureRedirect(request, linkType);
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role, is_active")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError || !profile?.is_active || !canAccessAdmin(profile.role)) {
        return failureRedirect(request, linkType);
      }
    }

    // Only a relative path is passed to the URL constructor. safeNextPath blocks
    // absolute URLs, protocol-relative URLs and backslash tricks (open redirects).
    const nextPath = safeNextPath(
      parsed.data.next,
      linkType === "verification" ? "/verification-success" : "/reset-password",
    );

    return NextResponse.redirect(new URL(nextPath, request.url));
  } catch (error) {
    console.error("Auth callback threw", error);
    return failureRedirect(request, linkType);
  }
}
