"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { describeAuthError } from "@/lib/auth-errors";
import { hashClientIp } from "@/lib/auth-security";
import { formString, toFieldErrors, type FormActionState } from "@/lib/form-state";
import { isLoginAllowed, recordLoginAttempt } from "@/lib/login-throttle";
import { canAccessAdmin } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { loginSchema, safeNextPath } from "@/lib/validators";

/**
 * Administrator authentication Server Actions.
 *
 * These run on the server only. Form input is re-validated here with Zod even
 * though the browser also validates it: anything can be posted to an action
 * endpoint. Sessions are written to HTTP-only, SameSite cookies by
 * `@supabase/ssr`, so no token is ever stored in `localStorage` or returned to
 * client JavaScript.
 */

const GENERIC_FORM_ERROR = "Please check the highlighted fields.";
const TOO_MANY_ATTEMPTS = "Too many sign-in attempts. Please wait 15 minutes and try again.";
const VERIFY_EMAIL = "Please confirm your email address before signing in to the admin panel.";

export async function loginAction(
  _previousState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const raw = { email: formString(formData, "email") };

  const parsed = loginSchema.safeParse({
    email: raw.email,
    password: formString(formData, "password"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: GENERIC_FORM_ERROR,
      fieldErrors: toFieldErrors(parsed.error),
      values: raw,
    };
  }

  const email = parsed.data.email;
  const headerStore = await headers();
  const ipHash = hashClientIp(
    headerStore.get("x-forwarded-for") ?? headerStore.get("x-real-ip"),
  );

  if (!(await isLoginAllowed(email, ipHash))) {
    return { status: "error", message: TOO_MANY_ATTEMPTS, fieldErrors: {}, values: raw };
  }

  const nextPath = safeNextPath(formString(formData, "next"), "/admin");
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: parsed.data.password,
  });

  if (error) {
    await recordLoginAttempt(email, ipHash, false);
    return {
      status: "error",
      message: describeAuthError(error.message),
      fieldErrors: {},
      values: raw,
    };
  }

  // Supabase only issues a session for a confirmed address when email
  // confirmation is enabled. This extra check protects projects where that
  // setting was accidentally turned off.
  if (!data.user?.email_confirmed_at) {
    await supabase.auth.signOut();
    await recordLoginAttempt(email, ipHash, false);
    return { status: "error", message: VERIFY_EMAIL, fieldErrors: {}, values: raw };
  }

  // Sign-in alone is not enough: the role comes from the database row scoped to
  // this user by RLS, never from a form field, cookie or JWT claim. A customer
  // session must not survive a rejected admin login.
  const userId = data.user?.id;
  const { data: profile, error: profileError } = userId
    ? await supabase
        .from("profiles")
        .select("role, is_active")
        .eq("id", userId)
        .maybeSingle()
    : { data: null, error: null };

  if (profileError || !profile?.is_active || !canAccessAdmin(profile?.role)) {
    await supabase.auth.signOut();
    await recordLoginAttempt(email, ipHash, false);
    return {
      status: "error",
      message: "Only active administrator accounts may sign in.",
      fieldErrors: {},
      values: raw,
    };
  }

  await recordLoginAttempt(email, ipHash, true);
  redirect(nextPath);
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();

  try {
    // Invalidate this refresh token on the Auth server, not just in the browser.
    await supabase.auth.signOut({ scope: "global" });
  } catch (error) {
    console.error("Sign-out request failed", error);
  }

  redirect("/login?notice=signed-out");
}
