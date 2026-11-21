"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth";
import { formString } from "@/lib/form-state";
import {
  initialWishlistState,
  wishlistInputSchema,
  type WishlistActionState,
} from "@/lib/wishlist";
import { createClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validators";

/**
 * Adds or removes one product from the signed-in customer's wishlist.
 *
 * The customer id comes from the verified session, never from the form, and RLS
 * confines the read/insert/delete to that customer's own rows. Only an active
 * product can be saved.
 */
export async function toggleWishlistAction(
  _previousState: WishlistActionState,
  formData: FormData,
): Promise<WishlistActionState> {
  const user = await requireUser("/wishlist");

  const parsed = wishlistInputSchema.safeParse({ productId: formString(formData, "productId") });
  if (!parsed.success) {
    return {
      ...initialWishlistState,
      status: "error",
      message: "That product could not be identified.",
      values: { productId: formString(formData, "productId") },
    };
  }

  const supabase = await createClient();
  const productId = parsed.data.productId;

  const { data: existing, error: lookupError } = await supabase
    .from("wishlist_items")
    .select("id")
    .eq("product_id", productId)
    .maybeSingle();

  if (lookupError) {
    console.error("wishlist lookup failed", lookupError.code, lookupError.message);
    return {
      ...initialWishlistState,
      status: "error",
      message: "Your wishlist could not be read right now. Please try again.",
      values: { productId },
    };
  }

  if (existing) {
    const { error } = await supabase.from("wishlist_items").delete().eq("id", existing.id);
    if (error) {
      console.error("wishlist remove failed", error.code, error.message);
      return {
        ...initialWishlistState,
        status: "error",
        message: "The item could not be removed. Please try again.",
        saved: true,
        values: { productId },
      };
    }
    revalidatePath("/wishlist");
    return {
      status: "success",
      message: "Removed from your wishlist.",
      fieldErrors: {},
      values: {},
      saved: false,
    };
  }

  // Only active catalogue products may be saved.
  const { data: product } = await supabase
    .from("products")
    .select("id")
    .eq("id", productId)
    .eq("is_active", true)
    .maybeSingle();

  if (!product) {
    return {
      ...initialWishlistState,
      status: "error",
      message: "That product is not available.",
      values: { productId },
    };
  }

  const { error } = await supabase.from("wishlist_items").insert({
    user_id: user.id,
    product_id: productId,
  });

  if (error) {
    console.error("wishlist add failed", error.code, error.message);
    return {
      ...initialWishlistState,
      status: "error",
      message: "The item could not be saved. Please try again.",
      values: { productId },
    };
  }

  revalidatePath("/wishlist");
  return {
    status: "success",
    message: "Saved to your wishlist.",
    fieldErrors: {},
    values: {},
    saved: true,
  };
}

/** Removes one item by wishlist row id. RLS still restricts it to the owner. */
export async function removeWishlistItemAction(formData: FormData): Promise<void> {
  await requireUser("/wishlist");

  const id = uuidSchema.safeParse(formString(formData, "itemId"));
  if (!id.success) return;

  const supabase = await createClient();
  const { error } = await supabase.from("wishlist_items").delete().eq("id", id.data);
  if (error) {
    console.error("wishlist remove failed", error.code, error.message);
    return;
  }

  revalidatePath("/wishlist");
}
