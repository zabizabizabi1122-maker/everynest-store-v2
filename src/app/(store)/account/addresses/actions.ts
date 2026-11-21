"use server";

import { revalidatePath } from "next/cache";

import {
  addressIdSchema,
  createAddressSchema,
  describeAddressError,
  type AddressActionState,
} from "@/lib/addresses";
import { requireUser } from "@/lib/auth";
import { formString, toFieldErrors } from "@/lib/form-state";
import { createClient } from "@/lib/supabase/server";

/** Saves a new delivery address for the signed-in customer. */
export async function createAddressAction(
  _previousState: AddressActionState,
  formData: FormData,
): Promise<AddressActionState> {
  const user = await requireUser("/account/addresses");

  const values = {
    label: formString(formData, "label"),
    fullName: formString(formData, "fullName"),
    phone: formString(formData, "phone"),
    address: formString(formData, "address"),
    city: formString(formData, "city"),
  };

  const parsed = createAddressSchema.safeParse(values);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please check the highlighted fields.",
      fieldErrors: toFieldErrors(parsed.error),
      values,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("saved_addresses").insert({
    user_id: user.id,
    label: parsed.data.label,
    full_name: parsed.data.fullName,
    phone: parsed.data.phone,
    address: parsed.data.address,
    city: parsed.data.city,
  });

  if (error) {
    console.error("saved address create failed", error.code, error.message);
    return {
      status: "error",
      message: describeAddressError(error.code),
      fieldErrors: error.code === "23514" ? { phone: ["Enter a valid phone number."] } : {},
      values,
    };
  }

  revalidatePath("/account/addresses");
  revalidatePath("/checkout");
  return {
    status: "success",
    message: "Address saved.",
    fieldErrors: {},
    values: {},
  };
}

/** Makes one of the caller's addresses the default through the trusted RPC. */
export async function setDefaultAddressAction(formData: FormData): Promise<void> {
  await requireUser("/account/addresses");

  const parsed = addressIdSchema.safeParse({ addressId: formString(formData, "addressId") });
  if (!parsed.success) return;

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_default_address", {
    p_address_id: parsed.data.addressId,
  });

  if (error) {
    console.error("set_default_address failed", error.code, error.message);
    return;
  }

  revalidatePath("/account/addresses");
  revalidatePath("/checkout");
}

/** Deletes one of the caller's addresses. RLS restricts the row to its owner. */
export async function deleteAddressAction(formData: FormData): Promise<void> {
  await requireUser("/account/addresses");

  const parsed = addressIdSchema.safeParse({ addressId: formString(formData, "addressId") });
  if (!parsed.success) return;

  const supabase = await createClient();
  const { error } = await supabase
    .from("saved_addresses")
    .delete()
    .eq("id", parsed.data.addressId);

  if (error) {
    console.error("saved address delete failed", error.code, error.message);
    return;
  }

  revalidatePath("/account/addresses");
  revalidatePath("/checkout");
}
