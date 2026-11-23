import { createHash } from "node:crypto";

import type { CookieOptions } from "@supabase/ssr";

/**
 * Shared session-security settings for the Supabase SSR clients.
 *
 * Supabase Auth remains the source of truth for sessions, refresh-token
 * rotation, password hashing and email links. These options only control how
 * the resulting cookies are written by Next.js. The library default is not
 * HTTP-only, so we explicitly harden it here.
 */

const DEFAULT_SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

/** Configurable cookie lifetime. Invalid values fall back to 30 days. */
export function getSessionMaxAgeSeconds(): number {
  const raw = process.env.AUTH_SESSION_MAX_AGE_SECONDS?.trim();
  if (!raw) return DEFAULT_SESSION_MAX_AGE_SECONDS;

  const value = Number(raw);
  if (!Number.isInteger(value) || value < 60 || value > 400 * 24 * 60 * 60) {
    return DEFAULT_SESSION_MAX_AGE_SECONDS;
  }

  return value;
}

/** Cookie options used by every server-side Supabase SSR client. */
export function getAuthCookieOptions(): CookieOptions {
  return {
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: getSessionMaxAgeSeconds(),
  };
}

/**
 * Pseudonymises a client IP before it is used as a rate-limit key.
 *
 * The raw address is never written to the database or logs. Only a truncated
 * SHA-256 digest is stored, which is enough to distinguish clients without
 * keeping personal network data.
 */
export function hashClientIp(value: string | null | undefined): string {
  const candidate = (value ?? "").split(",")[0]?.trim() ?? "";
  if (!candidate) return "unknown";

  return createHash("sha256").update(candidate).digest("hex").slice(0, 32);
}
