"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getCurrentUser, requirePermission } from "@/lib/auth";
import { type FormActionState, formString, toFieldErrors } from "@/lib/form-state";
import {
  getSettingsTables,
  loadAdminHeroSlides,
  type HeroSlideInsert,
} from "@/lib/site-settings";
import { uuidSchema } from "@/lib/validators";

import {
  contactFormSchema,
  heroSlideFormSchema,
  promoFormSchema,
  socialsFormSchema,
  type HeroSlideFormValues,
} from "./schemas";

/**
 * Every mutation checks the permission again on the server. The database RLS
 * policies repeat the same check; hiding the form is never the security layer.
 */
async function requireManage(): Promise<string | null> {
  await requirePermission("settings.manage", "/admin/settings");
  const user = await getCurrentUser();
  return user?.id ?? null;
}

function revalidateSettings(): void {
  // "/" with layout refreshes the storefront footer/promo in the shared shell.
  revalidatePath("/", "layout");
  revalidatePath("/admin/settings");
}

function failure(message: string, values?: Record<string, string>): FormActionState {
  return { status: "error", message, fieldErrors: {}, values };
}

async function saveSiteSetting(
  key: "promo" | "contact" | "socials",
  value: unknown,
  updatedBy: string | null,
): Promise<boolean> {
  const { siteSettings } = await getSettingsTables();
  const { error } = await siteSettings.upsert({ key, value, updated_by: updatedBy });

  if (error) {
    console.error(`site settings ${key} save failed`, error.code, error.message);
    return false;
  }

  return true;
}

function readStrings(formData: FormData, key: string): string[] {
  return formData.getAll(key).map((value) => (typeof value === "string" ? value : ""));
}

/* -------------------------------------------------------------------------- */
/* Promo                                                                      */
/* -------------------------------------------------------------------------- */

function readPromoForm(formData: FormData): Record<string, string> {
  return {
    message: formString(formData, "message"),
    shippingThresholdPaisa: formString(formData, "shippingThresholdPaisa"),
    enabled: formData.has("enabled") ? "true" : "false",
  };
}

export async function savePromoAction(
  _previousState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const updatedBy = await requireManage();
  const values = readPromoForm(formData);

  const parsed = promoFormSchema.safeParse({
    ...values,
    enabled: values.enabled === "true",
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please check the highlighted fields.",
      fieldErrors: toFieldErrors(parsed.error),
      values,
    };
  }

  if (!(await saveSiteSetting("promo", parsed.data, updatedBy))) {
    return failure("The promo settings could not be saved. Please try again.", values);
  }

  revalidateSettings();
  return { status: "success", message: "Promo bar saved.", fieldErrors: {}, values };
}

/* -------------------------------------------------------------------------- */
/* Contact                                                                    */
/* -------------------------------------------------------------------------- */

const CONTACT_KEYS = ["tagline", "note", "help", "email", "phone", "whatsapp", "address"] as const;

function readContactForm(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const key of CONTACT_KEYS) values[key] = formString(formData, key);
  return values;
}

export async function saveContactAction(
  _previousState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const updatedBy = await requireManage();
  const values = readContactForm(formData);
  const parsed = contactFormSchema.safeParse(values);

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please check the highlighted fields.",
      fieldErrors: toFieldErrors(parsed.error),
      values,
    };
  }

  if (!(await saveSiteSetting("contact", parsed.data, updatedBy))) {
    return failure("The contact details could not be saved. Please try again.", values);
  }

  revalidateSettings();
  return { status: "success", message: "Contact details saved.", fieldErrors: {}, values };
}

/* -------------------------------------------------------------------------- */
/* Social links                                                               */
/* -------------------------------------------------------------------------- */

export async function saveSocialsAction(
  _previousState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const updatedBy = await requireManage();
  const labels = readStrings(formData, "socialLabel");
  const urls = readStrings(formData, "socialUrl");
  const icons = readStrings(formData, "socialIcon");

  const rows = labels.map((label, index) => ({
    label,
    url: urls[index] ?? "",
    icon: icons[index] ?? "instagram",
  }));

  const parsed = socialsFormSchema.safeParse(rows);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const [index, field] = issue.path;
      const key =
        typeof index === "number"
          ? `social-${index}-${typeof field === "string" ? field : "label"}`
          : "socials";
      (fieldErrors[key] ??= []).push(issue.message);
    }

    return {
      status: "error",
      message: "Please check the highlighted social links.",
      fieldErrors,
    };
  }

  if (!(await saveSiteSetting("socials", parsed.data, updatedBy))) {
    return failure("The social links could not be saved. Please try again.");
  }

  revalidateSettings();
  return { status: "success", message: "Social links saved.", fieldErrors: {} };
}

/* -------------------------------------------------------------------------- */
/* Hero slides                                                                */
/* -------------------------------------------------------------------------- */

interface RawHeroForm {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  image: string;
  imageAlt: string;
  primaryLabel: string;
  primaryHref: string;
  secondaryLabel: string;
  secondaryHref: string;
  displayOrder: string;
  isActive: boolean;
}

const HERO_KEYS = [
  "eyebrow",
  "title",
  "description",
  "image",
  "imageAlt",
  "primaryLabel",
  "primaryHref",
  "secondaryLabel",
  "secondaryHref",
  "displayOrder",
] as const;

function readHeroForm(formData: FormData): RawHeroForm {
  const values = {} as Record<(typeof HERO_KEYS)[number], string>;
  for (const key of HERO_KEYS) values[key] = formString(formData, key);

  return {
    ...values,
    id: formString(formData, "id"),
    isActive: formData.has("isActive"),
  };
}

function heroFormValues(raw: RawHeroForm): Record<string, string> {
  const values: Record<string, string> = { id: raw.id };
  for (const key of HERO_KEYS) values[key] = raw[key];
  values.isActive = raw.isActive ? "true" : "false";
  return values;
}

function toHeroInsert(data: HeroSlideFormValues): HeroSlideInsert {
  return {
    eyebrow: data.eyebrow || null,
    title: data.title,
    description: data.description || null,
    image: data.image,
    image_alt: data.imageAlt || null,
    primary_label: data.primaryLabel,
    primary_href: data.primaryHref,
    secondary_label: data.secondaryLabel || null,
    secondary_href: data.secondaryHref || null,
    display_order: data.displayOrder,
    is_active: data.isActive,
  };
}

export async function createHeroSlideAction(
  _previousState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  await requireManage();
  const raw = readHeroForm(formData);
  const parsed = heroSlideFormSchema.safeParse(raw);

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please check the highlighted fields.",
      fieldErrors: toFieldErrors(parsed.error),
      values: heroFormValues(raw),
    };
  }

  const { heroSlides } = await getSettingsTables();
  const { error } = await heroSlides.insert(toHeroInsert(parsed.data));

  if (error) {
    console.error("hero slide create failed", error.code, error.message);
    return failure("The hero slide could not be created. Please try again.", heroFormValues(raw));
  }

  revalidateSettings();
  return { status: "success", message: "Hero slide added.", fieldErrors: {} };
}

export async function updateHeroSlideAction(
  _previousState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  await requireManage();
  const raw = readHeroForm(formData);
  const id = uuidSchema.safeParse(raw.id);

  if (!id.success) {
    return failure("That hero slide could not be found.", heroFormValues(raw));
  }

  const parsed = heroSlideFormSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please check the highlighted fields.",
      fieldErrors: toFieldErrors(parsed.error),
      values: heroFormValues(raw),
    };
  }

  const { heroSlides } = await getSettingsTables();
  const { error } = await heroSlides.update(toHeroInsert(parsed.data)).eq("id", id.data);

  if (error) {
    console.error("hero slide update failed", error.code, error.message);
    return failure("The hero slide could not be saved. Please try again.", heroFormValues(raw));
  }

  revalidateSettings();
  return { status: "success", message: "Hero slide saved.", fieldErrors: {}, values: heroFormValues(raw) };
}

/** Simple form actions below use redirects for errors and a shared pending button. */
export async function toggleHeroSlideAction(formData: FormData): Promise<void> {
  await requireManage();

  const id = uuidSchema.safeParse(formString(formData, "id"));
  const active = formString(formData, "active");
  if (!id.success || (active !== "true" && active !== "false")) {
    redirect("/admin/settings?notice=error");
  }

  const { heroSlides } = await getSettingsTables();
  const { error } = await heroSlides.update({ is_active: active === "true" }).eq("id", id.data);

  if (error) {
    console.error("hero slide status change failed", error.code, error.message);
    redirect("/admin/settings?notice=error");
  }

  revalidateSettings();
}

export async function deleteHeroSlideAction(formData: FormData): Promise<void> {
  await requireManage();

  const id = uuidSchema.safeParse(formString(formData, "id"));
  if (!id.success) redirect("/admin/settings?notice=error");

  const { heroSlides } = await getSettingsTables();
  const { error } = await heroSlides.delete().eq("id", id.data);

  if (error) {
    console.error("hero slide delete failed", error.code, error.message);
    redirect("/admin/settings?notice=error");
  }

  revalidateSettings();
}

/** Swaps a slide with its neighbour and normalizes display_order afterwards. */
export async function reorderHeroSlideAction(formData: FormData): Promise<void> {
  await requireManage();

  const id = uuidSchema.safeParse(formString(formData, "id"));
  const direction = formString(formData, "direction");
  if (!id.success || (direction !== "up" && direction !== "down")) {
    redirect("/admin/settings?notice=error");
  }

  const { rows } = await loadAdminHeroSlides();
  const index = rows.findIndex((row) => row.id === id.data);
  const target = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || target < 0 || target >= rows.length) {
    redirect("/admin/settings?notice=error");
  }

  const reordered = [...rows];
  [reordered[index], reordered[target]] = [reordered[target], reordered[index]];

  const { heroSlides } = await getSettingsTables();
  for (let position = 0; position < reordered.length; position += 1) {
    const displayOrder = (position + 1) * 10;
    if (reordered[position].display_order === displayOrder) continue;

    const { error } = await heroSlides
      .update({ display_order: displayOrder })
      .eq("id", reordered[position].id);

    if (error) {
      console.error("hero slide reorder failed", error.code, error.message);
      redirect("/admin/settings?notice=error");
    }
  }

  revalidateSettings();
}
