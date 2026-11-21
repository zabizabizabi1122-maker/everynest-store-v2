import { describe, expect, it } from "vitest";

import {
  addCartItem,
  CART_STORAGE_KEY,
  cartCount,
  cartSubtotalPaisa,
  MAX_CART_ITEMS,
  MAX_CART_QUANTITY,
  normalizeCartItems,
  readCart,
  removeCartItem,
  setCartQuantity,
  trustedCartImageUrl,
  writeCart,
  type CartItem,
} from "./cart";

const VARIANT_A = "b0000000-0000-4000-8000-000000000001";
const VARIANT_B = "b0000000-0000-4000-8000-000000000002";

function item(variantId: string, quantity: number, price = 129950): CartItem {
  return {
    variantId,
    quantity,
    display: {
      name: "Classic Cotton Shirt",
      attributesLabel: "Size: M, Color: Black",
      imageUrl: null,
      displayUnitPricePaisa: price,
    },
  };
}

describe("normalizeCartItems", () => {
  it("drops malformed entries and clamps quantities", () => {
    const result = normalizeCartItems([
      item(VARIANT_A, 5),
      { ...item(VARIANT_B, 2), variantId: "not-a-uuid" },
      { ...item(VARIANT_B, 0) },
      null,
      "junk",
      { ...item(VARIANT_B, 1000) },
    ]);

    expect(result).toHaveLength(2);
    expect(result[0].quantity).toBe(5);
    expect(result[1].quantity).toBe(MAX_CART_QUANTITY);
  });

  it("drops duplicate variant ids and enforces the item cap", () => {
    const duplicates = normalizeCartItems([item(VARIANT_A, 1), item(VARIANT_A, 2)]);
    expect(duplicates).toHaveLength(1);

    const many = Array.from({ length: MAX_CART_ITEMS + 5 }, (_, index) =>
      item(`b0000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`, 1),
    );
    expect(normalizeCartItems(many)).toHaveLength(MAX_CART_ITEMS);
  });

  it("rejects non-arrays and invalid display snapshots", () => {
    expect(normalizeCartItems(null)).toEqual([]);
    expect(normalizeCartItems({})).toEqual([]);
    expect(normalizeCartItems([{ ...item(VARIANT_A, 1), display: { ...item(VARIANT_A, 1).display, displayUnitPricePaisa: -1 } }])).toEqual([]);
  });
});

describe("cart mutations", () => {
  it("merges quantities when the same variant is added twice", () => {
    const result = addCartItem([item(VARIANT_A, 2)], item(VARIANT_A, 3));

    expect(result).toHaveLength(1);
    expect(result[0].quantity).toBe(5);
  });

  it("caps merged quantity and keeps new variants", () => {
    const capped = addCartItem([item(VARIANT_A, 90)], item(VARIANT_A, 20));
    expect(capped[0].quantity).toBe(MAX_CART_QUANTITY);

    const added = addCartItem([item(VARIANT_A, 1)], item(VARIANT_B, 1));
    expect(added.map((entry) => entry.variantId)).toEqual([VARIANT_A, VARIANT_B]);
  });

  it("updates, removes and counts quantities", () => {
    const items = [item(VARIANT_A, 2), item(VARIANT_B, 1)];

    expect(setCartQuantity(items, VARIANT_A, 4)[0].quantity).toBe(4);
    expect(setCartQuantity(items, VARIANT_A, 0)).toEqual([item(VARIANT_B, 1)]);
    expect(removeCartItem(items, VARIANT_A)).toEqual([item(VARIANT_B, 1)]);
    expect(cartCount(items)).toBe(3);
  });

  it("computes a display-only subtotal", () => {
    expect(cartSubtotalPaisa([item(VARIANT_A, 2, 100000), item(VARIANT_B, 1, 50000)])).toBe(250000);
  });
});

describe("cart storage", () => {
  function fakeStorage(): Storage {
    const store = new Map<string, string>();
    return {
      get length() {
        return store.size;
      },
      clear: () => store.clear(),
      getItem: (key) => store.get(key) ?? null,
      key: (index) => [...store.keys()][index] ?? null,
      removeItem: (key) => store.delete(key),
      setItem: (key, value) => {
        store.set(key, value);
      },
    } as Storage;
  }

  it("round-trips through storage and ignores corrupt JSON", () => {
    const storage = fakeStorage();

    expect(readCart(storage)).toEqual([]);
    writeCart(storage, [item(VARIANT_A, 2)]);
    expect(readCart(storage)).toHaveLength(1);
    expect(storage.getItem(CART_STORAGE_KEY)).toContain(VARIANT_A);

    storage.setItem(CART_STORAGE_KEY, "{not json");
    expect(readCart(storage)).toEqual([]);
  });

  it("is a no-op when storage is unavailable", () => {
    expect(readCart(null)).toEqual([]);
    expect(() => writeCart(null, [item(VARIANT_A, 1)])).not.toThrow();
  });
});

describe("trustedCartImageUrl", () => {
  it("allows http(s) URLs and rejects other schemes", () => {
    expect(trustedCartImageUrl("https://example.supabase.co/storage/x.png")).toBe(
      "https://example.supabase.co/storage/x.png",
    );
    expect(trustedCartImageUrl("javascript:alert(1)")).toBeNull();
    expect(trustedCartImageUrl("/relative.png")).toBeNull();
    expect(trustedCartImageUrl(null)).toBeNull();
  });

  it("allows strict local product image paths only", () => {
    expect(trustedCartImageUrl("/products/classic-cotton-shirt.jpg")).toBe(
      "/products/classic-cotton-shirt.jpg",
    );
    expect(trustedCartImageUrl("/products/classic-cotton-shirt.svg")).toBe(
      "/products/classic-cotton-shirt.svg",
    );
    expect(trustedCartImageUrl("/products/../secret.jpg")).toBeNull();
    expect(trustedCartImageUrl("/products/foo.gif")).toBeNull();
    expect(trustedCartImageUrl("//evil.com/products/x.jpg")).toBeNull();
  });
});
