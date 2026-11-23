"use server";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getSiteOrigin } from "@/lib/auth";
import { emailSchema } from "@/lib/validators";
import { formString, toFieldErrors, type FormActionState } from "@/lib/form-state";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

/** Generated types will include this RPC after the auth-security migration. */
type VerificationDatabase = Database & {
  public: {
    Functions: {
      can_request_email_verification: {
        Args: { p_email: string };
        Returns: boolean;
      };
    };
  };
};

/**
 * Resend a signup confirmation email.
 *
 * The response is deliberately identical whether or not the address exists, so
 * this endpoint cannot be used to enumerate accounts. Supabase stores and
 * verifies the one-time token; the database RPC only applies a 60-second
 * cooldown per address.
 */

const RESEND_SENT_MESSAGE =
  "If that account still needs verification, we've sent a fresh link. Check your inbox.";

export async function resendVerificationAction(
  _previousState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const email = formString(formData, "email");
  const parsed = emailSchema.safeParse(email);

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please check the highlighted fields.",
      fieldErrors: toFieldErrors(parsed.error),
      values: { email },
    };
  }

  try {
    const supabase = (await createClient()) as unknown as SupabaseClient<VerificationDatabase>;
    const { data, error } = await supabase.rpc("can_request_email_verification", {
      p_email: parsed.data,
    });

    if (error) {
      console.error("can_request_email_verification failed", error.code, error.message);
    }

    if (!error && data === true) {
      const origin = await getSiteOrigin();
      const next = encodeURIComponent("/verification-success");
      const { error: resendError } = await supabase.auth.resend({
        type: "signup",
        email: parsed.data,
        options: {
          emailRedirectTo: `${origin}/auth/callback?next=${next}&type=verification`,
        },
      });

      if (resendError) {
        console.error("Verification resend failed", resendError.message);
      }
    }
  } catch (error) {
    console.error("Verification resend threw", error);
  }

  return {
    status: "success",
    message: RESEND_SENT_MESSAGE,
    fieldErrors: {},
    values: { email: parsed.data },
  };
}
