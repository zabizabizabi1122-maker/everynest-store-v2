"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireStaff } from "@/lib/auth";
import { categoryHasVariants, loadCategoryTree } from "@/lib/category-data";
import {
  descendantIds,
  describeSchemaChange,
  fromSchemaJson,
  inheritedAttributes,
  mergeAttributes,
  parseCategorySchemaText,
  toSchemaJson,
} from "@/lib/category-schema";
import { formString, toFieldErrors, type FormActionState } from "@/lib/form-state";
import { createClient } from "@/lib/supabase/server";
import { slugSchema, uuidSchema } from "@/lib/validators";

/**
 * Level 4 Server Actions.
 *
 * Every action re-checks the session and the profile role before touching data:
 * a layout guard alone would not protect an action endpoint. Input is validated
 * with Zod, and the Level 4 + Level 1 database triggers remain the final layer.
 */

const categoryFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters.")
    .max(100, "Name must be 100 characters or fewer."),
  slug: slugSchema,
  parentId: z
    .union([uuidSchema, z.literal("")])
    .transform((value) => (value === "" ? null : value)),
});

interface RawCategoryForm {
  id: string;
  name: string;
  slug: string;
  parentId: string;
  isActive: boolean;
  attributeSchema: string;
}

function readCategoryForm(formData: FormData): RawCategoryForm {
  return {
    id: formString(formData, "id"),
    name: formString(formData, "name"),
    slug: formString(formData, "slug"),
    parentId: formString(formData, "parentId"),
    isActive: formData.has("isActive"),
    attributeSchema: formString(formData, "attributeSchema"),
  };
}

function toFormValues(raw: RawCategoryForm): Record<string, string> {
  return {
    id: raw.id,
    name: raw.name,
    slug: raw.slug,
    parentId: raw.parentId,
    isActive: raw.isActive ? "true" : "false",
    attributeSchema: raw.attributeSchema,
  };
}

function duplicateSlugMessage(): FormActionState {
  return {
    status: "error",
    message: "That slug is already in use. Choose a different one.",
    fieldErrors: { slug: ["Slug must be unique."] },
  };
}

export async function createCategoryAction(
  _previousState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  await requireStaff("/admin/categories/new");

  const raw = readCategoryForm(formData);
  const parsed = categoryFormSchema.safeParse(raw);
  const schema = parseCategorySchemaText(raw.attributeSchema);

  if (!parsed.success || !schema.success) {
    return {
      status: "error",
      message: "Please check the highlighted fields.",
      fieldErrors: {
        ...(parsed.success ? {} : toFieldErrors(parsed.error)),
        ...(schema.success ? {} : schema.fieldErrors),
      },
      values: toFormValues(raw),
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .insert({
      name: parsed.data.name,
      slug: parsed.data.slug,
      parent_id: parsed.data.parentId,
      attribute_schema: toSchemaJson(schema.data),
      is_active: raw.isActive,
    })
    .select("id")
    .single();

  if (error || !data) {
    if (error?.code === "23505") {
      return { ...duplicateSlugMessage(), values: toFormValues(raw) };
    }

    console.error("Category create failed", error?.message ?? "no row returned");
    return {
      status: "error",
      message: "We could not create the category. Please try again.",
      fieldErrors: {},
      values: toFormValues(raw),
    };
  }

  revalidatePath("/admin/categories");
  revalidatePath(`/admin/categories/${data.id}`);
  redirect(`/admin/categories/${data.id}?saved=created`);
}

export async function updateCategoryAction(
  _previousState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  await requireStaff("/admin/categories");

  const raw = readCategoryForm(formData);
  const id = uuidSchema.safeParse(raw.id);
  const parsed = categoryFormSchema.safeParse(raw);
  const schema = parseCategorySchemaText(raw.attributeSchema);

  if (!id.success) {
    return {
      status: "error",
      message: "That category could not be found.",
      fieldErrors: {},
      values: toFormValues(raw),
    };
  }

  if (!parsed.success || !schema.success) {
    return {
      status: "error",
      message: "Please check the highlighted fields.",
      fieldErrors: {
        ...(parsed.success ? {} : toFieldErrors(parsed.error)),
        ...(schema.success ? {} : schema.fieldErrors),
      },
      values: toFormValues(raw),
    };
  }

  const categories = await loadCategoryTree();
  const hasVariants = await categoryHasVariants(categories, id.data);
  const existing = categories.find((category) => category.id === id.data);

  if (!existing) {
    return {
      status: "error",
      message: "That category could not be found.",
      fieldErrors: {},
      values: toFormValues(raw),
    };
  }

  if (parsed.data.parentId === id.data || descendantIds(categories, id.data).includes(parsed.data.parentId ?? "")) {
    return {
      status: "error",
      message: "A category cannot be its own parent or be placed below one of its children.",
      fieldErrors: { parentId: ["Choose a different parent."] },
      values: toFormValues(raw),
    };
  }

  if (hasVariants) {
    if (existing.parent_id !== parsed.data.parentId) {
      return {
        status: "error",
        message: "The parent cannot be changed because variants in this category tree already depend on its schema.",
        fieldErrors: { parentId: ["Keep the current parent."] },
        values: toFormValues(raw),
      };
    }

    const changeError = describeSchemaChange(
      fromSchemaJson(existing.attribute_schema),
      schema.data,
      true,
    );

    if (changeError) {
      return {
        status: "error",
        message: changeError,
        fieldErrors: { attributeSchema: [changeError] },
        values: toFormValues(raw),
      };
    }
  }

  const merged = mergeAttributes(inheritedAttributes(categories, parsed.data.parentId), schema.data);

  if (merged.conflicts.length > 0) {
    return {
      status: "error",
      message: `These attributes conflict with inherited ones: ${merged.conflicts.join(", ")}. Remove the duplicates from this category.`,
      fieldErrors: { attributeSchema: ["Remove conflicting inherited attributes."] },
      values: toFormValues(raw),
    };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("categories")
    .update({
      name: parsed.data.name,
      slug: parsed.data.slug,
      parent_id: parsed.data.parentId,
      attribute_schema: toSchemaJson(schema.data),
      is_active: raw.isActive,
    })
    .eq("id", id.data)
    .select("id");

  if (error) {
    if (error.code === "23505") {
      return { ...duplicateSlugMessage(), values: toFormValues(raw) };
    }

    console.error("Category update failed", error.message);
    return {
      status: "error",
      message: error.code === "23514"
        ? "That change would make existing variants invalid. Keep existing attribute keys and options."
        : "We could not save the category. Please try again.",
      fieldErrors: {},
      values: toFormValues(raw),
    };
  }

  revalidatePath("/admin/categories");
  revalidatePath(`/admin/categories/${id.data}`);

  return {
    status: "success",
    message: "Category saved.",
    fieldErrors: {},
    values: toFormValues(raw),
  };
}

/** Archive or reactivate a category. No category is ever hard-deleted. */
export async function setCategoryActiveAction(formData: FormData): Promise<void> {
  await requireStaff("/admin/categories");

  const id = uuidSchema.safeParse(formString(formData, "id"));
  const isActive = formString(formData, "active") === "true";

  if (!id.success) {
    redirect("/admin/categories?status=error");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("categories")
    .update({ is_active: isActive })
    .eq("id", id.data)
    .select("id");

  if (error) {
    console.error("Category status change failed", error.message);
  }

  revalidatePath("/admin/categories");
  revalidatePath(`/admin/categories/${id.data}`);
  redirect(`/admin/categories?status=${error ? "error" : "updated"}`);
}
