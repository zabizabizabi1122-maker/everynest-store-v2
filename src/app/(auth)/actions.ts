"use server";

import { redirect } from "next/navigation";

import { describeAuthError } from "@/lib/auth-errors";
import { formString, toFieldErrors, type FormActionState } from "@/lib/form-state";
import { canAccessAdmin } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { loginSchema, safeNextPath } from "@/lib/validators";

/**
 * Administrator authentication Server Actions.
 *
 * These run on the server only. Form input is re-validated here with Zod even
 * though the browser also validates it: anything can be posted to an action
 * endpoint. Sessions are written to httpOnly cookies by `@supabase/ssr`, so no
 * token is ever stored in `localStorage` or returned to client JavaScript.
 */

const GENERIC_FORM_ERROR = "Please check the highlighted fields.";

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

  const nextPath = safeNextPath(formString(formData, "next"), "/admin");
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    return {
      status: "error",
      message: describeAuthError(error.message),
      fieldErrors: {},
      values: { email: parsed.data.email },
    };
  }

  // Sign-in alone is not enough: the role comes from the database row scoped to
  // this user by RLS, never from a form field, cookie or JWT claim. A customer
  // session must not survive a rejected admin login.
  const userId = data.user?.id;
  const { data: profile, error: profileError } = userId
    ? await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .maybeSingle()
    : { data: null, error: null };

  if (profileError || !canAccessAdmin(profile?.role)) {
    await supabase.auth.signOut();
    return {
      status: "error",
      message: "Only administrator accounts may sign in.",
      fieldErrors: {},
      values: { email: parsed.data.email },
    };
  }

  redirect(nextPath);
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
