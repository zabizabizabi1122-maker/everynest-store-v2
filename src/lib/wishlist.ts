import { z } from "zod";

import { type FormActionState } from "@/lib/form-state";
import { uuidSchema } from "@/lib/validators";

/**
 * Level 11 — wishlist contract.
 *
 * Wishlist rows are ordinary per-user records: ownership is enforced by RLS,
 * not by a trusted RPC. The only browser input is a product id, validated here
 * on the server before any database write.
 */

export const wishlistInputSchema = z
  .object({ productId: uuidSchema })
  .strict();

export interface WishlistActionState extends FormActionState {
  saved: boolean;
}

export const initialWishlistState: WishlistActionState = {
  status: "idle",
  message: null,
  fieldErrors: {},
  values: {},
  saved: false,
};

/** A product row reduced to what the wishlist page needs to render. */
export interface WishlistProduct {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  minPricePaisa: number | null;
  inStock: boolean;
}
