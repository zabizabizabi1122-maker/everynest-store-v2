import { z } from "zod";

/**
 * Shared server-side validators.
 *
 * Every Server Action, Route Handler and public RPC input passes through Zod
 * on the server. These schemas are deliberately strict: unknown fields are
 * rejected by callers that use `.strict()`.
 */

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SKU_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;

export const uuidSchema = z
  .string()
  .trim()
  .regex(UUID_PATTERN, "Expected a valid UUID.");

export const slugSchema = z
  .string()
  .trim()
  .min(1, "Slug is required.")
  .max(80, "Slug must be 80 characters or fewer.")
  .regex(SLUG_PATTERN, "Slug may only contain lowercase letters, numbers and single hyphens.");

export const skuSchema = z
  .string()
  .trim()
  .min(1, "SKU is required.")
  .max(64, "SKU must be 64 characters or fewer.")
  .regex(SKU_PATTERN, "SKU may only contain letters, numbers, hyphens and underscores.");

/**
 * Normalizes Pakistani mobile numbers to E.164 without punctuation.
 *
 * Accepted inputs:
 *   - 03xxxxxxxxx          (local, 11 digits)
 *   - +923xxxxxxxxx        (international)
 *   - 00923xxxxxxxxx       (international with 00 prefix)
 *   - 923xxxxxxxxx         (international without plus)
 *
 * Returns "+923xxxxxxxxx" or null when the number is not a valid Pakistani
 * mobile number. Never trusts client-side formatting.
 */
export function normalizePakistaniPhone(input: string): string | null {
  const cleaned = input.trim().replace(/[\s().-]/g, "");

  let national: string | null = null;

  if (/^0\d{10}$/.test(cleaned)) {
    national = cleaned.slice(1);
  } else if (/^\+92\d{10}$/.test(cleaned)) {
    national = cleaned.slice(3);
  } else if (/^0092\d{10}$/.test(cleaned)) {
    national = cleaned.slice(4);
  } else if (/^92\d{10}$/.test(cleaned)) {
    national = cleaned.slice(2);
  }

  if (national === null || !/^3\d{9}$/.test(national)) {
    return null;
  }

  return `+92${national}`;
}

export const pakistaniPhoneSchema = z
  .string()
  .trim()
  .min(1, "Phone number is required.")
  .transform((value, ctx) => {
    const normalized = normalizePakistaniPhone(value);
    if (normalized === null) {
      ctx.addIssue({
        code: "custom",
        message: "Enter a valid Pakistani mobile number (03xxxxxxxxx or +923xxxxxxxxx).",
      });
      return z.NEVER;
    }
    return normalized;
  });

/**
 * Optional variant of `pakistaniPhoneSchema`: an empty string means "no phone
 * number" and is stored as NULL. Anything else must be a valid mobile number.
 */
export const optionalPakistaniPhoneSchema = z
  .string()
  .trim()
  .max(32, "Phone number is too long.")
  .transform((value, ctx) => {
    if (value === "") return null;

    const normalized = normalizePakistaniPhone(value);
    if (normalized === null) {
      ctx.addIssue({
        code: "custom",
        message: "Enter a valid Pakistani mobile number (03xxxxxxxxx or +923xxxxxxxxx).",
      });
      return z.NEVER;
    }
    return normalized;
  });

export const emailSchema = z
  .string()
  .trim()
  .min(1, "Email is required.")
  .max(254, "Email must be 254 characters or fewer.")
  .email("Enter a valid email address.")
  .transform((value) => value.toLowerCase());

/**
 * Password policy for new accounts.
 *
 * 8 characters minimum is Supabase's recommended default. 72 is the hard limit
 * of the password hashing algorithm, so longer input is rejected instead of
 * being silently truncated.
 */
export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(72, "Password must be 72 characters or fewer.")
  .refine((value) => /[A-Za-z]/.test(value), "Password must contain at least one letter.")
  .refine((value) => /[0-9]/.test(value), "Password must contain at least one number.");

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required.").max(72, "Password is too long."),
});

export const signupSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(2, "Enter your full name.")
      .max(100, "Full name must be 100 characters or fewer."),
    email: emailSchema,
    phone: optionalPakistaniPhoneSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Confirm your password."),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

/** Fields a customer may change on their own profile (never `role`). */
export const profileUpdateSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Enter your full name.")
    .max(100, "Full name must be 100 characters or fewer."),
  phone: optionalPakistaniPhoneSchema,
});

/**
 * Allows only same-site relative redirects.
 *
 * Blocks protocol-relative (`//evil.com`), absolute URLs and backslash tricks
 * so a `?next=` parameter can never be used as an open redirect.
 */
export function safeNextPath(value: string | null | undefined, fallback = "/admin"): string {
  if (!value) return fallback;

  const path = value.trim();

  if (!path.startsWith("/")) return fallback;
  if (path.startsWith("//")) return fallback;
  if (path.includes("\\")) return fallback;

  return path;
}

export const nonEmptyTextSchema = z
  .string()
  .trim()
  .min(1, "This field is required.")
  .max(200, "This field must be 200 characters or fewer.");

export const optionalTextSchema = z
  .string()
  .trim()
  .max(2000, "This field must be 2000 characters or fewer.")
  .optional()
  .transform((value) => (value === "" ? undefined : value));
