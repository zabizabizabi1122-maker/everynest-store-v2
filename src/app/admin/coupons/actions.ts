"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requirePermission } from "@/lib/auth";
import { createCouponSchema } from "@/lib/coupons";
import { type FormActionState, formString, toFieldErrors } from "@/lib/form-state";
import { uuidSchema } from "@/lib/validators";
import { createClient } from "@/lib/supabase/server";

/** Creates a coupon. Admin-only in both this action and the database RLS. */
export async function createCouponAction(
  _previousState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  await requirePermission("coupons.manage", "/admin/coupons");

  const parsed = createCouponSchema.safeParse({
    code: formString(formData, "code"),
    description: formString(formData, "description"),
    discountType: formString(formData, "discountType"),
    discountValue: formString(formData, "discountValue"),
    minSubtotalPaisa: formString(formData, "minSubtotalPaisa") || "0",
    maxUses: formString(formData, "maxUses"),
    endsAt: formString(formData, "endsAt"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please check the highlighted fields.",
      fieldErrors: toFieldErrors(parsed.error),
    };
  }

  const minSubtotal = Number(parsed.data.minSubtotalPaisa);
  if (!Number.isSafeInteger(minSubtotal)) {
    return {
      status: "error",
      message: "The minimum spend is too large.",
      fieldErrors: { minSubtotalPaisa: ["Use a smaller amount."] },
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("coupons").insert({
    code: parsed.data.code,
    description: parsed.data.description || null,
    discount_type: parsed.data.discountType,
    discount_value: Number(parsed.data.discountValue),
    min_subtotal_paisa: minSubtotal,
    max_uses: parsed.data.maxUses === "" ? null : Number(parsed.data.maxUses),
    ends_at: parsed.data.endsAt === "" ? null : new Date(parsed.data.endsAt).toISOString(),
  });

  if (error) {
    console.error("coupon create failed", error.code, error.message);
    return {
      status: "error",
      message: error.code === "23505" ? "That code already exists." : "The coupon could not be saved.",
      fieldErrors: error.code === "23505" ? { code: ["Choose a different code."] } : {},
    };
  }

  revalidatePath("/admin/coupons");
  return { status: "success", message: `Coupon ${parsed.data.code} created.`, fieldErrors: {} };
}

/** Activates or deactivates a coupon without deleting its history. */
export async function setCouponActiveAction(formData: FormData): Promise<void> {
  await requirePermission("coupons.manage", "/admin/coupons");

  const id = uuidSchema.safeParse(formString(formData, "id"));
  const active = formString(formData, "active");
  if (!id.success || (active !== "true" && active !== "false")) {
    redirect("/admin/coupons?notice=invalid");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("coupons")
    .update({ is_active: active === "true" })
    .eq("id", id.data);

  if (error) {
    console.error("coupon status change failed", error.code, error.message);
    redirect("/admin/coupons?notice=error");
  }

  revalidatePath("/admin/coupons");
}
