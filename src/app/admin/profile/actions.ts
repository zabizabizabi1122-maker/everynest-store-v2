"use server";

import { revalidatePath } from "next/cache";

import { requireStaff } from "@/lib/auth";
import { type FormActionState, formString, toFieldErrors } from "@/lib/form-state";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const profileSchema = z.object({
  fullName: z.string().trim().max(120).default(""),
  phone: z
    .string()
    .trim()
    .max(30)
    .refine((value) => value === "" || /^[+0-9()\-\s]{5,30}$/.test(value), {
      message: "Use a valid phone number.",
    }),
});

/** Updates only the two profile columns clients are granted. */
export async function updateMyProfileAction(
  _previousState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const { user } = await requireStaff("/admin/profile");

  const raw = {
    fullName: formString(formData, "fullName"),
    phone: formString(formData, "phone"),
  };
  const parsed = profileSchema.safeParse(raw);

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please check the highlighted fields.",
      fieldErrors: toFieldErrors(parsed.error),
      values: raw,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.fullName || null,
      phone: parsed.data.phone || null,
    })
    .eq("id", user.id);

  if (error) {
    return {
      status: "error",
      message: "Your profile could not be saved. Please try again.",
      fieldErrors: {},
      values: parsed.data,
    };
  }

  revalidatePath("/admin/profile");
  return { status: "success", message: "Profile saved.", fieldErrors: {}, values: parsed.data };
}
