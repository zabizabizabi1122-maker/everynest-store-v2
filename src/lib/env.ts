import { z } from "zod";

/**
 * Public environment validation.
 *
 * EveryNest only needs the Supabase project URL and the public
 * (publishable/anon) key in the browser and on the server. The optional
 * SUPABASE_SERVICE_ROLE_KEY is read directly by a server-only helper for Admin
 * Management and is never exposed through this public configuration object.
 *
 * Validation is lazy on purpose:
 *  - `next build` must work before a developer has created `.env.local`.
 *  - Any code path that actually talks to Supabase fails loudly with a clear
 *    message instead of silently using empty values.
 */
const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .trim()
    .min(1, "NEXT_PUBLIC_SUPABASE_URL is required (for example https://xyzcompany.supabase.co).")
    .refine((value) => {
      try {
        const url = new URL(value);
        return url.protocol === "https:" || url.protocol === "http:";
      } catch {
        return false;
      }
    }, "NEXT_PUBLIC_SUPABASE_URL must be a valid http(s) URL."),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z
    .string()
    .trim()
    .min(20, "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY looks too short to be a Supabase public key."),
});

export interface PublicEnv {
  url: string;
  publishableKey: string;
}

let cached: PublicEnv | null = null;

/**
 * Returns the validated public Supabase configuration.
 *
 * Throws a readable error listing every missing/invalid variable so the
 * developer knows exactly what to put in `.env.local`.
 */
export function getPublicEnv(): PublicEnv {
  if (cached) return cached;

  // Reference the variables statically so Next.js can inline them in the
  // browser bundle.
  const parsed = publicEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".") || "environment"}: ${issue.message}`)
      .join("\n");
    throw new Error(
      `Invalid environment configuration:\n${details}\nCreate .env.local from .env.example and add your Supabase project URL and publishable key.`,
    );
  }

  cached = {
    url: parsed.data.NEXT_PUBLIC_SUPABASE_URL.replace(/\/+$/, ""),
    publishableKey: parsed.data.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  };

  return cached;
}

/** True when Supabase environment variables are present and valid. */
export function isSupabaseConfigured(): boolean {
  try {
    getPublicEnv();
    return true;
  } catch {
    return false;
  }
}
