import { z } from "zod";

import { isSafeHeroHref, SOCIAL_ICONS } from "@/lib/site-settings";

/**
 * Server-side validation for the website settings forms. These schemas are
 * shared only by the settings Server Actions; the browser never decides what
 * is valid or authorized.
 */

const paisaInputSchema = z
  .string()
  .trim()
  .regex(/^\d{1,12}$/, "Enter a whole amount in paisa (digits only).")
  .transform((value) => Number(value))
  .refine((value) => Number.isSafeInteger(value), "Amount is too large.");

export const promoFormSchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, "Promo message is required.")
    .max(300, "Promo message must be 300 characters or fewer."),
  shippingThresholdPaisa: paisaInputSchema,
  enabled: z.boolean(),
});

const contactEmailSchema = z
  .string()
  .trim()
  .max(254, "Email must be 254 characters or fewer.")
  .refine(
    (value) => value === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
    "Enter a valid email address or leave blank.",
  );

const contactPhoneSchema = z
  .string()
  .trim()
  .max(40, "Phone number is too long.")
  .refine(
    (value) => value === "" || /^\+?[0-9][0-9\s()-]{5,30}$/.test(value),
    "Enter a valid phone number or leave blank.",
  );

const whatsappSchema = contactPhoneSchema.refine(
  (value) => {
    if (!value) return true;
    const digits = value.replace(/\D/g, "");
    return digits.length >= 8 && digits.length <= 15;
  },
  "Enter a valid WhatsApp number with country code.",
);

export const contactFormSchema = z.object({
  tagline: z.string().trim().max(200, "Tagline must be 200 characters or fewer."),
  note: z.string().trim().max(500, "Note must be 500 characters or fewer."),
  help: z.string().trim().max(500, "Help text must be 500 characters or fewer."),
  email: contactEmailSchema,
  phone: contactPhoneSchema,
  whatsapp: whatsappSchema,
  address: z.string().trim().max(300, "Address must be 300 characters or fewer."),
});

export const socialFormSchema = z.object({
  label: z
    .string()
    .trim()
    .min(1, "Give each social link a label.")
    .max(80, "Label must be 80 characters or fewer."),
  url: z
    .string()
    .trim()
    .max(500, "URL must be 500 characters or fewer.")
    .refine(
      (value) => value === "" || (/^https?:\/\//i.test(value) && isSafeHeroHref(value)),
      "Use a full http(s) URL or leave blank.",
    ),
  icon: z.enum(SOCIAL_ICONS),
});

export const socialsFormSchema = z
  .array(socialFormSchema)
  .max(12, "Use at most 12 social links.");

const heroHrefSchema = z
  .string()
  .trim()
  .max(500, "Link must be 500 characters or fewer.")
  .refine(isSafeHeroHref, "Use a relative path like /products or a full http(s) URL.");

const optionalHeroHrefSchema = z
  .string()
  .trim()
  .max(500, "Link must be 500 characters or fewer.")
  .refine((value) => value === "" || isSafeHeroHref(value), "Use a relative path or full http(s) URL.");

const displayOrderSchema = z
  .string()
  .trim()
  .regex(/^-?\d{1,6}$/, "Enter a whole order number.")
  .transform((value) => Number(value));

export const heroSlideFormSchema = z
  .object({
    eyebrow: z.string().trim().max(120, "Eyebrow must be 120 characters or fewer."),
    title: z
      .string()
      .trim()
      .min(1, "Title is required.")
      .max(160, "Title must be 160 characters or fewer."),
    description: z.string().trim().max(600, "Description must be 600 characters or fewer."),
    image: z
      .string()
      .trim()
      .min(1, "Image path is required.")
      .max(500, "Image path must be 500 characters or fewer."),
    imageAlt: z.string().trim().max(200, "Alt text must be 200 characters or fewer."),
    primaryLabel: z
      .string()
      .trim()
      .min(1, "Primary label is required.")
      .max(80, "Primary label must be 80 characters or fewer."),
    primaryHref: heroHrefSchema,
    secondaryLabel: z.string().trim().max(80, "Secondary label must be 80 characters or fewer."),
    secondaryHref: optionalHeroHrefSchema,
    displayOrder: displayOrderSchema,
    isActive: z.boolean(),
  })
  .refine(
    (value) => (value.secondaryLabel === "") === (value.secondaryHref === ""),
    {
      path: ["secondaryLabel"],
      message: "Provide both a secondary label and link, or leave both blank.",
    },
  );

export type PromoFormValues = z.infer<typeof promoFormSchema>;
export type ContactFormValues = z.infer<typeof contactFormSchema>;
export type SocialFormValues = z.infer<typeof socialFormSchema>;
export type HeroSlideFormValues = z.infer<typeof heroSlideFormSchema>;
