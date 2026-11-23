import type { HeroSlide } from "@/components/store/hero-carousel";
import { formatPkr } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

/**
 * Core website settings readers and parsers.
 *
 * The storefront must still look correct before a single settings row exists,
 * so every parser falls back to the values that were previously hardcoded in
 * the layout/home page. All untrusted JSONB is narrowed here, in one place.
 */

export const SOCIAL_ICONS = ["instagram", "facebook", "twitter"] as const;
export type SocialIcon = (typeof SOCIAL_ICONS)[number];

export interface PromoSettings {
  message: string;
  /** Integer paisa. */
  shippingThresholdPaisa: number;
  enabled: boolean;
}

export interface ContactSettings {
  tagline: string;
  note: string;
  help: string;
  email: string;
  phone: string;
  whatsapp: string;
  address: string;
}

export interface SocialLink {
  label: string;
  url: string;
  icon: SocialIcon;
}

export interface SiteSettings {
  promo: PromoSettings;
  contact: ContactSettings;
  socials: SocialLink[];
  /** Whether each row actually exists in the database (for admin empty states). */
  has: { promo: boolean; contact: boolean; socials: boolean };
  /** Friendly message when the read failed; storefront callers can ignore it. */
  error: string | null;
}

export const DEFAULT_PROMO: PromoSettings = {
  message: "Free delivery over {amount}",
  shippingThresholdPaisa: 300_000,
  enabled: true,
};

export const DEFAULT_CONTACT: ContactSettings = {
  tagline: "EveryNest · Pakistan",
  note: "Nationwide delivery and cash on delivery on every order.",
  help: "Order help is available from our support team.",
  email: "",
  phone: "",
  whatsapp: "",
  address: "",
};

export const DEFAULT_SOCIALS: SocialLink[] = [
  { label: "Instagram", url: "", icon: "instagram" },
  { label: "Facebook", url: "", icon: "facebook" },
  { label: "Twitter", url: "", icon: "twitter" },
];

/* -------------------------------------------------------------------------- */
/* Parsers                                                                    */
/* -------------------------------------------------------------------------- */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readText(value: unknown, fallback: string, max: number): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : fallback;
}

function readOptionalText(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function readContactEmail(value: unknown): string {
  const email = readOptionalText(value, 254);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

function readContactPhone(value: unknown): string {
  const phone = readOptionalText(value, 40);
  return /^\+?[0-9][0-9\s()-]{5,30}$/.test(phone) ? phone : "";
}

/** Only http(s) URLs become clickable; everything else stays decorative. */
export function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/** Relative store paths and http(s) URLs are safe hero links. */
export function isSafeHeroHref(value: string): boolean {
  const href = value.trim();
  if (!href) return false;
  if (href.startsWith("/") && !href.startsWith("//") && !href.includes("\\")) return true;
  return isHttpUrl(href);
}

export function safeHeroHref(value: string | null | undefined, fallback = "/products"): string {
  if (typeof value !== "string") return fallback;
  return isSafeHeroHref(value) ? value.trim() : fallback;
}

export function parsePromoSettings(value: unknown): PromoSettings {
  const raw = isRecord(value) ? value : {};
  const threshold = raw.shippingThresholdPaisa;

  return {
    message: readText(raw.message, DEFAULT_PROMO.message, 300),
    shippingThresholdPaisa:
      typeof threshold === "number" && Number.isSafeInteger(threshold) && threshold >= 0
        ? threshold
        : DEFAULT_PROMO.shippingThresholdPaisa,
    enabled: typeof raw.enabled === "boolean" ? raw.enabled : DEFAULT_PROMO.enabled,
  };
}

export function parseContactSettings(value: unknown): ContactSettings {
  const raw = isRecord(value) ? value : {};

  return {
    tagline: readText(raw.tagline, DEFAULT_CONTACT.tagline, 200),
    note: readText(raw.note, DEFAULT_CONTACT.note, 500),
    help: readText(raw.help, DEFAULT_CONTACT.help, 500),
    email: readContactEmail(raw.email),
    phone: readContactPhone(raw.phone),
    whatsapp: readContactPhone(raw.whatsapp),
    address: readOptionalText(raw.address, 300),
  };
}

export function parseSocialLink(value: unknown): SocialLink | null {
  if (!isRecord(value)) return null;

  const label = readOptionalText(value.label, 80);
  const url = readOptionalText(value.url, 500);
  const icon = SOCIAL_ICONS.find((candidate) => candidate === value.icon) ?? "instagram";

  return { label: label || icon, url, icon };
}

export function parseSocials(value: unknown): SocialLink[] {
  if (!Array.isArray(value)) return DEFAULT_SOCIALS;

  return value
    .slice(0, 12)
    .map(parseSocialLink)
    .filter((link): link is SocialLink => link !== null);
}

/** Replaces every `{amount}` placeholder with the formatted PKR threshold. */
export function formatPromoMessage(promo: PromoSettings): string {
  const message = promo.message.trim() ? promo.message : DEFAULT_PROMO.message;
  return message.replace(/\{amount\}/g, formatPkr(promo.shippingThresholdPaisa));
}

/* -------------------------------------------------------------------------- */
/* Hero slides                                                                */
/* -------------------------------------------------------------------------- */

export interface HeroSlideRow {
  id: string;
  eyebrow: string | null;
  title: string;
  description: string | null;
  image: string;
  image_alt: string | null;
  primary_label: string;
  primary_href: string;
  secondary_label: string | null;
  secondary_href: string | null;
  display_order: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export type HeroSlideInsert = {
  eyebrow?: string | null;
  title: string;
  description?: string | null;
  image: string;
  image_alt?: string | null;
  primary_label: string;
  primary_href?: string;
  secondary_label?: string | null;
  secondary_href?: string | null;
  display_order?: number;
  is_active?: boolean;
};

export type HeroSlideUpdate = Partial<HeroSlideInsert>;

/** Maps a database row onto the interface already used by HeroCarousel. */
export function heroSlideRowToSlide(row: HeroSlideRow): HeroSlide {
  const eyebrow = typeof row.eyebrow === "string" ? row.eyebrow.trim() : "";
  const description = typeof row.description === "string" ? row.description.trim() : "";
  const imageAlt = row.image_alt?.trim() || row.title;
  const secondaryLabel = row.secondary_label?.trim() ?? "";
  const secondaryHref = secondaryLabel ? safeHeroHref(row.secondary_href) : "";

  return {
    eyebrow,
    title: row.title,
    description,
    image: row.image.trim() || "/products/canvas-backpack.jpg",
    imageAlt,
    primary: { label: row.primary_label, href: safeHeroHref(row.primary_href) },
    secondary: secondaryHref
      ? { label: secondaryLabel, href: secondaryHref }
      : { label: "Browse catalogue", href: "/products" },
  };
}

/* -------------------------------------------------------------------------- */
/* Request-bound readers                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Narrow hand-written table types for the two new tables. `database.types.ts`
 * will be regenerated from the migration later; keeping the casts here (and in
 * the settings actions) avoids weakening typing anywhere else in the app.
 */
export interface SettingsDbError {
  code?: string;
  message: string;
}

export interface SettingsQuery<Row>
  extends PromiseLike<{ data: Row[] | null; error: SettingsDbError | null }> {
  eq(column: string, value: string | number | boolean): SettingsQuery<Row>;
  order(column: string, options?: { ascending?: boolean }): SettingsQuery<Row>;
  limit(count: number): SettingsQuery<Row>;
}

export interface SettingsTable<Row, Insert, Update> {
  select(columns?: string): SettingsQuery<Row>;
  insert(values: Insert | Insert[]): SettingsQuery<Row>;
  upsert(values: Insert | Insert[]): SettingsQuery<Row>;
  update(values: Update): SettingsQuery<Row>;
  delete(): SettingsQuery<Row>;
}

export interface SiteSettingsRow {
  key: string;
  value: unknown;
  updated_at?: string;
  updated_by?: string | null;
}

export interface SiteSettingsInsert {
  key: string;
  value: unknown;
  updated_by?: string | null;
}

export type SiteSettingsUpdate = Partial<SiteSettingsInsert>;

export async function getSettingsTables() {
  const supabase = await createClient();

  // Call `.from` as a method so Supabase keeps its internal `this` binding.
  const table = <Row, Insert, Update>(name: string): SettingsTable<Row, Insert, Update> =>
    (supabase as unknown as { from: (name: string) => SettingsTable<Row, Insert, Update> }).from(name);

  return {
    siteSettings: table<SiteSettingsRow, SiteSettingsInsert, SiteSettingsUpdate>("site_settings"),
    heroSlides: table<HeroSlideRow, HeroSlideInsert, HeroSlideUpdate>("hero_slides"),
  };
}

const HERO_COLUMNS = [
  "id",
  "eyebrow",
  "title",
  "description",
  "image",
  "image_alt",
  "primary_label",
  "primary_href",
  "secondary_label",
  "secondary_href",
  "display_order",
  "is_active",
].join(", ");

export async function loadSiteSettings(): Promise<SiteSettings> {
  const { siteSettings } = await getSettingsTables();
  const { data, error } = await siteSettings.select("key, value");

  const has = { promo: false, contact: false, socials: false };
  if (error) {
    console.error("site settings load failed", error.code, error.message);
    return {
      promo: DEFAULT_PROMO,
      contact: DEFAULT_CONTACT,
      socials: DEFAULT_SOCIALS,
      has,
      error: "Settings could not be loaded right now. Storefront defaults are in use.",
    };
  }

  const values = new Map<string, unknown>();
  for (const row of data ?? []) {
    values.set(row.key, row.value);
  }

  has.promo = values.has("promo");
  has.contact = values.has("contact");
  has.socials = values.has("socials");

  return {
    promo: has.promo ? parsePromoSettings(values.get("promo")) : DEFAULT_PROMO,
    contact: has.contact ? parseContactSettings(values.get("contact")) : DEFAULT_CONTACT,
    socials: has.socials ? parseSocials(values.get("socials")) : DEFAULT_SOCIALS,
    has,
    error: null,
  };
}

/** Public slides only; active and in display order. Empty means use defaults. */
export async function loadActiveHeroSlides(): Promise<HeroSlide[]> {
  const { heroSlides } = await getSettingsTables();
  const { data, error } = await heroSlides
    .select(HERO_COLUMNS)
    .eq("is_active", true)
    .order("display_order", { ascending: true })
    .order("title", { ascending: true });

  if (error) {
    console.error("hero slides load failed", error.code, error.message);
    return [];
  }

  return (data ?? []).map(heroSlideRowToSlide);
}

/** Admin list includes inactive slides and reports read failures. */
export async function loadAdminHeroSlides(): Promise<{
  rows: HeroSlideRow[];
  error: string | null;
}> {
  const { heroSlides } = await getSettingsTables();
  const { data, error } = await heroSlides
    .select(HERO_COLUMNS)
    .order("display_order", { ascending: true })
    .order("title", { ascending: true });

  if (error) {
    console.error("admin hero slides load failed", error.code, error.message);
    return { rows: [], error: "Hero slides could not be loaded right now." };
  }

  return { rows: data ?? [], error: null };
}
