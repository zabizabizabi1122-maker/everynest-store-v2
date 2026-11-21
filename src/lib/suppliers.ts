import { z } from "zod";

/**
 * Level 6 — supplier input rules.
 * Shared by the supplier action and its unit tests. The action re-checks the
 * admin role and the database RLS policy remains the final write authority.
 */
export const supplierFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters.")
    .max(100, "Name must be 100 characters or fewer."),
  // Suppliers may have landlines, so this is deliberately broader than the
  // customer mobile-number validator.
  phone: z
    .string()
    .trim()
    .max(32, "Phone must be 32 characters or fewer.")
    .regex(/^\+?[0-9][0-9\s-]{5,31}$/, "Use digits, spaces, hyphens and an optional leading +.")
    .or(z.literal("")),
  address: z.string().trim().max(300, "Address must be 300 characters or fewer."),
});
