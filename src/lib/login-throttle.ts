import type { SupabaseClient } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

/**
 * App-level login throttling.
 *
 * Supabase Auth already applies provider-level limits. This small database
 * throttle adds a per-account/per-client lockout for repeated wrong passwords.
 * It stores only an email and a pseudonymous IP digest - never a password or a
 * token - and always uses generic browser messages so it cannot be used to
 * probe which accounts exist.
 */

type LoginThrottleDatabase = Database & {
  public: {
    Functions: {
      check_login_allowed: {
        Args: { p_email: string; p_ip_hash: string };
        Returns: boolean;
      };
      record_login_attempt: {
        Args: { p_email: string; p_ip_hash: string; p_success: boolean };
        Returns: void;
      };
    };
  };
};

async function throttleClient(): Promise<SupabaseClient<LoginThrottleDatabase>> {
  return (await createClient()) as unknown as SupabaseClient<LoginThrottleDatabase>;
}

/** Returns false when this email/client pair is temporarily locked out. */
export async function isLoginAllowed(email: string, ipHash: string): Promise<boolean> {
  try {
    const supabase = await throttleClient();
    const { data, error } = await supabase.rpc("check_login_allowed", {
      p_email: email,
      p_ip_hash: ipHash,
    });

    if (error) {
      console.error("check_login_allowed failed", error.code, error.message);
      // Availability fallback: Supabase Auth's own rate limits still apply.
      return true;
    }

    return data !== false;
  } catch (error) {
    console.error("check_login_allowed threw", error);
    return true;
  }
}

/** Records a success (clears failures) or a failure (may start a lockout). */
export async function recordLoginAttempt(
  email: string,
  ipHash: string,
  success: boolean,
): Promise<void> {
  try {
    const supabase = await throttleClient();
    const { error } = await supabase.rpc("record_login_attempt", {
      p_email: email,
      p_ip_hash: ipHash,
      p_success: success,
    });

    if (error) console.error("record_login_attempt failed", error.code, error.message);
  } catch (error) {
    console.error("record_login_attempt threw", error);
  }
}
