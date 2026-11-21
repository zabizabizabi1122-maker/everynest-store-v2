import { uuidSchema } from "@/lib/validators";

/**
 * Level 7 — client-side shopping cart model.
 *
 * The cart is NOT authoritative: it stores only a variant id, a quantity and a
 * display snapshot. No price, stock, discount or total from here may ever be
 * trusted by checkout (Level 8) — the server re-reads every variant before an
 * order is placed. `displayUnitPricePaisa` exists purely so the drawer can show
 * a familiar number while browsing.
 */

export const MAX_CART_QUANTITY = 99;
export const MAX_CART_ITEMS = 50;

export interface CartDisplay {
  name: string;
  attributesLabel: string;
  imageUrl: string | null;
  /** Display-only snapshot. Never use this to compute an order total. */
  displayUnitPricePaisa: number;
}

export interface CartItem {
  variantId: string;
  quantity: number;
  display: CartDisplay;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function clampQuantity(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const whole = Math.trunc(value);
  if (whole <= 0) return null;
  return Math.min(whole, MAX_CART_QUANTITY);
}

function parseDisplay(value: unknown): CartDisplay | null {
  if (!isObject(value)) return null;

  const price = value.displayUnitPricePaisa;
  if (typeof price !== "number" || !Number.isSafeInteger(price) || price < 0) return null;

  return {
    name: typeof value.name === "string" ? value.name.slice(0, 100) : "Product",
    attributesLabel:
      typeof value.attributesLabel === "string" ? value.attributesLabel.slice(0, 200) : "",
    imageUrl: typeof value.imageUrl === "string" && value.imageUrl.trim() !== "" ? value.imageUrl : null,
    displayUnitPricePaisa: price,
  };
}

/** Drops anything malformed from an untrusted localStorage/JSON payload. */
export function normalizeCartItems(value: unknown): CartItem[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const items: CartItem[] = [];

  for (const entry of value) {
    if (!isObject(entry)) continue;
    if (typeof entry.variantId !== "string" || !uuidSchema.safeParse(entry.variantId).success) continue;

    const quantity = clampQuantity(entry.quantity);
    const display = parseDisplay(entry.display);
    if (quantity === null || display === null || seen.has(entry.variantId)) continue;

    seen.add(entry.variantId);
    items.push({ variantId: entry.variantId, quantity, display });
    if (items.length >= MAX_CART_ITEMS) break;
  }

  return items;
}

/** Adds a variant or increases its quantity; existing items keep their position. */
export function addCartItem(items: readonly CartItem[], incoming: CartItem): CartItem[] {
  const normalized = normalizeCartItems([incoming]);
  if (normalized.length === 0) return [...items];

  const existing = items.find((item) => item.variantId === normalized[0].variantId);

  if (existing) {
    return items.map((item) =>
      item.variantId === normalized[0].variantId
        ? { ...item, quantity: Math.min(item.quantity + normalized[0].quantity, MAX_CART_QUANTITY), display: normalized[0].display }
        : item,
    );
  }

  if (items.length >= MAX_CART_ITEMS) return [...items];
  return [...items, normalized[0]];
}

export function setCartQuantity(items: readonly CartItem[], variantId: string, quantity: number): CartItem[] {
  if (quantity <= 0) return removeCartItem(items, variantId);
  const capped = Math.min(Math.trunc(quantity), MAX_CART_QUANTITY);

  return items.map((item) => (item.variantId === variantId ? { ...item, quantity: capped } : item));
}

export function removeCartItem(items: readonly CartItem[], variantId: string): CartItem[] {
  return items.filter((item) => item.variantId !== variantId);
}

export function cartCount(items: readonly CartItem[]): number {
  return items.reduce((sum, item) => sum + item.quantity, 0);
}

/** Approximate subtotal for display only; checkout must recalculate it. */
export function cartSubtotalPaisa(items: readonly CartItem[]): number {
  return items.reduce((sum, item) => sum + item.display.displayUnitPricePaisa * item.quantity, 0);
}

export const CART_STORAGE_KEY = "everynest-cart-v1";

/** Reads the cart from storage. Safe during SSR when `storage` is null. */
export function readCart(storage: Storage | null): CartItem[] {
  if (!storage) return [];

  try {
    const raw = storage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    return normalizeCartItems(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function writeCart(storage: Storage | null, items: readonly CartItem[]): void {
  if (!storage) return;

  try {
    storage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Storage may be full or disabled (private mode); the cart still works in
    // memory for the current session.
  }
}

/**
 * Cart snapshots originate in localStorage, so an image URL can be tampered
 * with. Only http(s) URLs on our own Supabase origin and strict local product
 * image paths served from /public are safe to render with `next/image`;
 * anything else falls back to the neutral placeholder.
 */
const LOCAL_PRODUCT_IMAGE = /^\/products\/[a-z0-9-]+\.(jpg|png|webp|svg)$/;

export function trustedCartImageUrl(url: string | null): string | null {
  if (!url) return null;

  // Seeded development products use local branded SVG placeholders. Allow only
  // an exact /products/<slug>.svg shape so no traversal or injected URL slips in.
  if (LOCAL_PRODUCT_IMAGE.test(url)) return url;

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;

    const expected = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (expected) {
      try {
        if (parsed.origin !== new URL(expected).origin) return null;
      } catch {
        return null;
      }
    }

    return url;
  } catch {
    return null;
  }
}
