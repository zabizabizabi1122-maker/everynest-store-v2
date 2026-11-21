import { describe, expect, it } from "vitest";

import { initialWishlistState, wishlistInputSchema } from "./wishlist";

const VALID_ID = "a0000000-0000-4000-8000-000000000002";

describe("wishlist input validation", () => {
  it("accepts a valid product id", () => {
    expect(wishlistInputSchema.safeParse({ productId: VALID_ID }).success).toBe(true);
  });

  it("rejects malformed ids and extra fields", () => {
    expect(wishlistInputSchema.safeParse({ productId: "not-a-uuid" }).success).toBe(false);
    expect(
      wishlistInputSchema.safeParse({ productId: VALID_ID, userId: "someone-else" }).success,
    ).toBe(false);
  });

  it("starts with a neutral state", () => {
    expect(initialWishlistState.status).toBe("idle");
    expect(initialWishlistState.saved).toBe(false);
    expect(initialWishlistState.fieldErrors).toEqual({});
  });
});
