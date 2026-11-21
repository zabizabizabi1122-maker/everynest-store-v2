"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth";
import { formString, toFieldErrors, type FormActionState } from "@/lib/form-state";
import { createClient } from "@/lib/supabase/server";
import { supplierFormSchema } from "@/lib/suppliers";
import { uuidSchema } from "@/lib/validators";

/**
 * Supplier writes are admin-only. RLS already restricts INSERT/UPDATE on
 * `suppliers` to `private.is_admin()`, but the action checks the role first so a
 * staff member gets a friendly redirect instead of a raw database error. The
 * Zod schema lives in `@/lib/suppliers` so it can be unit tested directly.
 */

interface RawSupplierForm {
  id: string;
  name: string;
  phone: string;
  address: string;
  isActive: boolean;
}

function readSupplierForm(formData: FormData): RawSupplierForm {
  return {
    id: formString(formData, "id"),
    name: formString(formData, "name"),
    phone: formString(formData, "phone"),
    address: formString(formData, "address"),
    isActive: formData.has("isActive"),
  };
}

function toFormValues(raw: RawSupplierForm): Record<string, string> {
  return {
    id: raw.id,
    name: raw.name,
    phone: raw.phone,
    address: raw.address,
    isActive: raw.isActive ? "true" : "false",
  };
}

function errorState(raw: RawSupplierForm, error: z.ZodError): FormActionState {
  return {
    status: "error",
    message: "Please check the highlighted fields.",
    fieldErrors: toFieldErrors(error),
    values: toFormValues(raw),
  };
}

function saveError(message: string, raw: RawSupplierForm): FormActionState {
  return { status: "error", message, fieldErrors: {}, values: toFormValues(raw) };
}

export async function createSupplierAction(
  _previousState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  await requireAdmin("/admin/suppliers/new");

  const raw = readSupplierForm(formData);
  const parsed = supplierFormSchema.safeParse(raw);

  if (!parsed.success) return errorState(raw, parsed.error);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("suppliers")
    .insert({
      name: parsed.data.name,
      phone: parsed.data.phone || null,
      address: parsed.data.address || null,
      is_active: raw.isActive,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("Supplier create failed", error?.message ?? "no row returned");
    return saveError("We could not create the supplier. Please try again.", raw);
  }

  revalidatePath("/admin/suppliers");
  revalidatePath(`/admin/suppliers/${data.id}`);
  redirect(`/admin/suppliers/${data.id}?saved=created`);
}

export async function updateSupplierAction(
  _previousState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  await requireAdmin("/admin/suppliers");

  const raw = readSupplierForm(formData);
  const id = uuidSchema.safeParse(raw.id);

  if (!id.success) return saveError("That supplier could not be found.", raw);

  const parsed = supplierFormSchema.safeParse(raw);

  if (!parsed.success) return errorState(raw, parsed.error);

  const supabase = await createClient();
  const { error } = await supabase
    .from("suppliers")
    .update({
      name: parsed.data.name,
      phone: parsed.data.phone || null,
      address: parsed.data.address || null,
      is_active: raw.isActive,
    })
    .eq("id", id.data)
    .select("id");

  if (error) {
    console.error("Supplier update failed", error.message);
    return saveError("We could not save the supplier. Please try again.", raw);
  }

  revalidatePath("/admin/suppliers");
  revalidatePath(`/admin/suppliers/${id.data}`);

  return {
    status: "success",
    message: "Supplier saved.",
    fieldErrors: {},
    values: toFormValues(raw),
  };
}

/** Archive or reactivate a supplier. Suppliers are never hard-deleted. */
export async function setSupplierActiveAction(formData: FormData): Promise<void> {
  await requireAdmin("/admin/suppliers");

  const id = uuidSchema.safeParse(formString(formData, "id"));
  const isActive = formString(formData, "active") === "true";

  if (!id.success) {
    redirect("/admin/suppliers?status=error");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("suppliers")
    .update({ is_active: isActive })
    .eq("id", id.data)
    .select("id");

  if (error) console.error("Supplier status change failed", error.message);

  revalidatePath("/admin/suppliers");
  revalidatePath(`/admin/suppliers/${id.data}`);
  redirect(`/admin/suppliers?status=${error ? "error" : "updated"}`);
}
