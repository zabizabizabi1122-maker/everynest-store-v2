import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { emailSchema } from "@/lib/validators";
import type { Database } from "@/types/database.types";

/**
 * Schemas for the built-in Supabase password-recovery flow.
 *
 * Server Actions re-parse every submission with these schemas: client-side
 * validation is a convenience, never the trust boundary.
 */
export const forgotPasswordSchema = z
  .object({
    email: emailSchema,
  })
  .strict();

export const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, "Password must be at least 8 characters.")
      .max(72, "Password must be 72 characters or fewer."),
    confirmPassword: z.string().min(1, "Confirm your new password."),
  })
  .strict()
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

/** One response for every request outcome, so the form cannot probe for accounts. */
export const PASSWORD_RESET_SENT_MESSAGE =
  "If an account exists for that email, we've sent a link to reset its password. Check your inbox.";

/**
 * Generated database types predate the throttle RPC added in the latest
 * migration. Extend them locally instead of editing `database.types.ts`; the
 * runtime client is still the regular server client from `@/lib/supabase/server`.
 */
type PasswordRecoveryDatabase = Database & {
  public: {
    Functions: {
      can_request_password_reset: {
        Args: { p_email: string };
        Returns: boolean;
      };
    };
  };
};

/** Returns false for throttled, invalid or unavailable throttle checks. */
export async function canRequestPasswordReset(email: string): Promise<boolean> {
  try {
    const supabase = (await createClient()) as unknown as SupabaseClient<PasswordRecoveryDatabase>;

    const { data, error } = await supabase.rpc("can_request_password_reset", {
      p_email: email,
    });

    if (error) {
      console.error("can_request_password_reset failed", error.code, error.message);
      return false;
    }

    return data === true;
  } catch (error) {
    console.error("can_request_password_reset threw", error);
    return false;
  }
}
