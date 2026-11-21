/**
 * Translates Supabase Auth errors into short, friendly messages.
 *
 * Raw provider messages must never reach the browser: they are terse, sometimes
 * leak internal details, and change between versions. Matching is best-effort
 * and always falls back to a safe generic message.
 */
const FALLBACK = "Something went wrong. Please try again.";

export function describeAuthError(message: string | null | undefined): string {
  const raw = (message ?? "").toLowerCase();

  if (!raw) return FALLBACK;

  if (raw.includes("invalid login credentials")) {
    return "Email or password is incorrect.";
  }

  if (raw.includes("email not confirmed")) {
    return "Please confirm your email address before logging in.";
  }

  if (raw.includes("already registered") || raw.includes("already been registered")) {
    return "An account with this email already exists. Try logging in instead.";
  }

  if (raw.includes("rate limit") || raw.includes("too many")) {
    return "Too many attempts right now. Please wait a few minutes and try again.";
  }

  if (raw.includes("signups not allowed") || raw.includes("signup is disabled")) {
    return "New sign-ups are disabled right now. Please try again later.";
  }

  if (raw.includes("password")) {
    return "Choose a stronger password (at least 8 characters, with a letter and a number).";
  }

  if (raw.includes("network") || raw.includes("fetch")) {
    return "We could not reach the authentication service. Check your connection and try again.";
  }

  return FALLBACK;
}
