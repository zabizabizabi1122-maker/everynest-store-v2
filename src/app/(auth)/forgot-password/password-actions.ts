"use server";

import { redirect } from "next/navigation";

import {
  canRequestPasswordReset,
  forgotPasswordSchema,
  PASSWORD_RESET_SENT_MESSAGE,
  resetPasswordSchema,
} from "@/lib/password-recovery";
import { getCurrentUser, getSiteOrigin } from "@/lib/auth";
import { formString, toFieldErrors, type FormActionState } from "@/lib/form-state";
import { createClient } from "@/lib/supabase/server";

/**
 * Password-recovery Server Actions.
 *
 * Supabase Auth owns the single-use reset token. These actions only validate
 * input, apply the database throttle and hand the token exchange to the
 * callback route. Provider errors are logged here and never returned.
 */

const FORM_ERROR = "Please check the highlighted fields.";
const INVALID_LINK_MESSAGE = "That reset link is invalid or has expired. Request a new one.";
const UPDATE_ERROR_MESSAGE = "We couldn't update your password. Request a new link and try again.";

export async function requestPasswordResetAction(
  _previousState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const raw = { email: formString(formData, "email") };
  const parsed = forgotPasswordSchema.safeParse(raw);

  if (!parsed.success) {
    return {
      status: "error",
      message: FORM_ERROR,
      fieldErrors: toFieldErrors(parsed.error),
      values: raw,
    };
  }

  const email = parsed.data.email;

  // A false result (throttle, invalid input or RPC failure) is silent: the
  // browser gets the same success response as a real email send.
  if (!(await canRequestPasswordReset(email))) {
    return {
      status: "success",
      message: PASSWORD_RESET_SENT_MESSAGE,
      fieldErrors: {},
      values: { email },
    };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${await getSiteOrigin()}/auth/callback?next=${encodeURIComponent("/reset-password")}&type=recovery`,
    });

    if (error) {
      console.error("resetPasswordForEmail failed", error.message);
    }
  } catch (error) {
    console.error("resetPasswordForEmail threw", error);
  }

  return {
    status: "success",
    message: PASSWORD_RESET_SENT_MESSAGE,
    fieldErrors: {},
    values: { email },
  };
}

export async function updatePasswordAction(
  _previousState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const raw = {
    password: formString(formData, "password"),
    confirmPassword: formString(formData, "confirmPassword"),
  };

  const parsed = resetPasswordSchema.safeParse(raw);

  if (!parsed.success) {
    return {
      status: "error",
      message: FORM_ERROR,
      fieldErrors: toFieldErrors(parsed.error),
      values: {}, // Passwords are never echoed back to the browser.
    };
  }

  // The page already guards this; re-check in the action because actions can be
  // invoked directly. getUser() verifies the session with Supabase Auth.
  const user = await getCurrentUser();
  if (!user) {
    return {
      status: "error",
      message: INVALID_LINK_MESSAGE,
      fieldErrors: {},
      values: {},
    };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.updateUser({ password: parsed.data.password });

    if (error) {
      console.error("updateUser password reset failed", error.message);
      return {
        status: "error",
        message: UPDATE_ERROR_MESSAGE,
        fieldErrors: {},
        values: {},
      };
    }
  } catch (error) {
    console.error("updateUser password reset threw", error);
    return {
      status: "error",
      message: UPDATE_ERROR_MESSAGE,
      fieldErrors: {},
      values: {},
    };
  }

  // Supabase issued a temporary recovery session for this reset. Invalidate all
  // sessions so old refresh tokens cannot survive the password change.
  try {
    const supabase = await createClient();
    await supabase.auth.signOut({ scope: "global" });
  } catch (error) {
    console.error("Password reset sign-out failed", error);
  }

  redirect("/login?notice=password-updated");
}
