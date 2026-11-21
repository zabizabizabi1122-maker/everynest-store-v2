"use server";

import { redirect } from "next/navigation";

import { getSiteOrigin } from "@/lib/auth";
import { describeAuthError } from "@/lib/auth-errors";
import { formString, toFieldErrors, type FormActionState } from "@/lib/form-state";
import { createClient } from "@/lib/supabase/server";
import { loginSchema, safeNextPath, signupSchema } from "@/lib/validators";

/**
 * Authentication Server Actions.
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

  const nextPath = safeNextPath(formString(formData, "next"));
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
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

  redirect(nextPath);
}

export async function signupAction(
  _previousState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const raw = {
    fullName: formString(formData, "fullName"),
    email: formString(formData, "email"),
    phone: formString(formData, "phone"),
  };

  const parsed = signupSchema.safeParse({
    ...raw,
    password: formString(formData, "password"),
    confirmPassword: formString(formData, "confirmPassword"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: GENERIC_FORM_ERROR,
      fieldErrors: toFieldErrors(parsed.error),
      // Passwords are intentionally not echoed back.
      values: raw,
    };
  }

  const origin = await getSiteOrigin();
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      // Display name and phone only. Roles are never accepted from signup
      // metadata: the database trigger always inserts `customer`.
      data: {
        full_name: parsed.data.fullName,
        ...(parsed.data.phone ? { phone: parsed.data.phone } : {}),
      },
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent("/account")}`,
    },
  });

  if (error) {
    return {
      status: "error",
      message: describeAuthError(error.message),
      fieldErrors: {},
      values: raw,
    };
  }

  // Email confirmation disabled: the session already exists.
  if (data.session) {
    redirect("/account");
  }

  // Confirmation required. The same message is shown for a brand-new email and
  // an already-registered one, so the form cannot be used to discover accounts.
  return {
    status: "success",
    message:
      "Check your inbox. If this email is new, we sent a confirmation link — open it to finish creating your account. If you already registered, log in instead.",
    fieldErrors: {},
    values: { fullName: parsed.data.fullName, email: parsed.data.email, phone: raw.phone },
  };
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
