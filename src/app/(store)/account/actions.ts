"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { formString, toFieldErrors, type FormActionState } from "@/lib/form-state";
import { createClient } from "@/lib/supabase/server";
import { profileUpdateSchema } from "@/lib/validators";

/**
 * Updates the signed-in customer's own profile.
 *
 * Only `full_name` and `phone` are sent. The database grants `UPDATE` on exactly
 * those two columns, and the RLS policy restricts the row to `auth.uid()`, so a
 * tampered request cannot change another profile or the `role` column.
 */
export async function updateProfileAction(
  _previousState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent("/account")}`);
  }

  const raw = {
    fullName: formString(formData, "fullName"),
    phone: formString(formData, "phone"),
  };

  const parsed = profileUpdateSchema.safeParse(raw);

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please check the highlighted fields.",
      fieldErrors: toFieldErrors(parsed.error),
      values: raw,
    };
  }

  const { data, error } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.fullName,
      phone: parsed.data.phone,
    })
    .eq("id", user.id)
    .select("id");

  // A blocked update affects zero rows without raising an error, so "no row
  // returned" is treated as a failure instead of silently reporting success.
  if (error || !data || data.length === 0) {
    return {
      status: "error",
      message: "We could not save your profile. Please try again.",
      fieldErrors: {},
      values: raw,
    };
  }

  revalidatePath("/account");

  return {
    status: "success",
    message: "Your profile has been updated.",
    fieldErrors: {},
    values: {
      fullName: parsed.data.fullName,
      phone: parsed.data.phone ?? "",
    },
  };
}
