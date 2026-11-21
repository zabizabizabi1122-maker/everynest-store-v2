"use server";

import { revalidatePath } from "next/cache";

import { requireStaff } from "@/lib/auth";
import { formString, toFieldErrors, type FormActionState } from "@/lib/form-state";
import { describeStockError, stockAdjustmentSchema } from "@/lib/inventory";
import { createClient } from "@/lib/supabase/server";

/**
 * Stock is only ever changed through the Level 1 `adjust_stock` RPC. That
 * function is SECURITY DEFINER, checks `private.is_staff()`, locks the variant
 * row, rejects negative stock and appends the movement in the same transaction.
 * This action deliberately performs no direct `product_variants` update.
 */
export async function adjustStockAction(
  _previousState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  await requireStaff("/admin/inventory");

  const raw = {
    variantId: formString(formData, "variantId"),
    change: formString(formData, "change"),
    reason: formString(formData, "reason"),
    supplierId: formString(formData, "supplierId"),
    note: formString(formData, "note"),
  };

  const parsed = stockAdjustmentSchema.safeParse(raw);

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please check the highlighted fields.",
      fieldErrors: toFieldErrors(parsed.error),
      values: raw,
    };
  }

  const { variantId, change, reason, supplierId, note } = parsed.data;
  const supabase = await createClient();

  const { error } = await supabase.rpc("adjust_stock", {
    p_variant_id: variantId,
    p_change: change,
    p_reason: reason,
    ...(supplierId ? { p_supplier_id: supplierId } : {}),
    ...(note ? { p_note: note } : {}),
  });

  if (error) {
    // Log the technical detail server-side; only the mapped message is returned.
    console.error("adjust_stock failed", error.code, error.message);
    return {
      status: "error",
      message: describeStockError(error.code),
      fieldErrors: {},
      values: raw,
    };
  }

  revalidatePath("/admin/inventory");
  revalidatePath("/admin/products");

  return {
    status: "success",
    message: `Stock updated by ${change > 0 ? "+" : ""}${change} units.`,
    fieldErrors: {},
    values: { ...raw, change: "1", note: "" },
  };
}
