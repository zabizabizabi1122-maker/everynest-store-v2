"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requirePermission } from "@/lib/auth";
import { formString, toFieldErrors, type FormActionState } from "@/lib/form-state";
import {
  deleteFilterDefinition,
  insertFilterDefinition,
  isDuplicateFilterKeyError,
  setFilterDefinitionActive,
  updateFilterDefinition,
  type FilterDbError,
} from "@/lib/filters";
import { uuidSchema } from "@/lib/validators";

/**
 * Server Actions for filter configuration. The permission is re-checked here,
 * not just in the page or the sidebar, and every mutation revalidates both the
 * admin list and the public catalogue.
 */

const keySchema = z
  .string()
  .trim()
  .min(1, "Key is required.")
  .max(60, "Key must be 60 characters or fewer.")
  .regex(/^[a-z][a-z0-9_]*$/, "Use lowercase letters, numbers and underscores.");

const typeSchema = z.enum([
  "attribute",
  "brand",
  "price",
  "availability",
  "rating",
  "featured",
  "discount",
  "new_arrivals",
]);

const colorSchema = z.union([
  z.literal(""),
  z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Use a hex colour such as #2563EB."),
]);

const optionSchema = z.object({
  id: z.union([uuidSchema, z.literal("")]),
  value: z.string().trim().min(1, "Option value is required.").max(100, "Option value is too long."),
  label: z.string().trim().min(1, "Option label is required.").max(100, "Option label is too long."),
  colorHex: colorSchema,
  displayOrder: z.number().int().min(0).max(10000),
  isActive: z.boolean(),
});

const filterFormSchema = z
  .object({
    id: z.union([uuidSchema, z.literal("")]),
    key: keySchema,
    label: z.string().trim().min(1, "Label is required.").max(80, "Label must be 80 characters or fewer."),
    description: z.string().trim().max(500, "Description must be 500 characters or fewer."),
    type: typeSchema,
    sourceKey: z.union([keySchema, z.literal("")]),
    isActive: z.boolean(),
    isMultiple: z.boolean(),
    appliesToAll: z.boolean(),
    displayOrder: z.number().int().min(-1000).max(10000),
    categoryIds: z.array(uuidSchema).max(200),
    options: z.array(optionSchema).max(200),
  })
  .refine((value) => value.type !== "attribute" || value.sourceKey !== "", {
    path: ["sourceKey"],
    message: "Attribute filters need a source key (for example color or size).",
  })
  .refine(
    (value) => new Set(value.options.map((option) => option.value.trim().toLowerCase())).size === value.options.length,
    { path: ["options"], message: "Each option value must be unique." },
  );

interface RawFilterForm {
  id: string;
  key: string;
  label: string;
  description: string;
  type: string;
  sourceKey: string;
  isActive: boolean;
  isMultiple: boolean;
  appliesToAll: boolean;
  displayOrder: number;
  categoryIds: string[];
  options: unknown;
}

function readInteger(value: string): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : Number.NaN;
}

function readFilterForm(formData: FormData): RawFilterForm {
  let options: unknown = null;
  try {
    options = JSON.parse(formString(formData, "options"));
  } catch {
    // The Zod schema reports the friendly field error below.
  }

  return {
    id: formString(formData, "id"),
    key: formString(formData, "key"),
    label: formString(formData, "label"),
    description: formString(formData, "description"),
    type: formString(formData, "type"),
    sourceKey: formString(formData, "sourceKey"),
    isActive: formData.has("isActive"),
    isMultiple: formData.has("isMultiple"),
    appliesToAll: formData.has("appliesToAll"),
    displayOrder: readInteger(formString(formData, "displayOrder")),
    categoryIds: formData.getAll("categoryIds").filter((value): value is string => typeof value === "string"),
    options,
  };
}

function toFormValues(raw: RawFilterForm): Record<string, string> {
  return {
    id: raw.id,
    key: raw.key,
    label: raw.label,
    description: raw.description,
    type: raw.type,
    sourceKey: raw.sourceKey,
    isActive: String(raw.isActive),
    isMultiple: String(raw.isMultiple),
    appliesToAll: String(raw.appliesToAll),
    displayOrder: String(raw.displayOrder),
    categoryIds: raw.categoryIds.join(","),
    options: typeof raw.options === "string" ? raw.options : JSON.stringify(raw.options ?? []),
  };
}

function failure(raw: RawFilterForm, message: string, fieldErrors: Record<string, string[]> = {}): FormActionState {
  return { status: "error", message, fieldErrors, values: toFormValues(raw) };
}

function mutationError(raw: RawFilterForm, error: FilterDbError): FormActionState {
  if (isDuplicateFilterKeyError(error)) {
    return failure(raw, "That key is already in use. Choose a different one.", { key: ["Key must be unique."] });
  }

  console.error("Filter save failed", error.code ?? "unknown", error.message);
  return failure(raw, "We could not save the filter. Please check the values and try again.");
}

export async function createFilterAction(
  _previousState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  await requirePermission("filters.manage", "/admin/filters/new");

  const raw = readFilterForm(formData);
  const parsed = filterFormSchema.safeParse(raw);
  if (!parsed.success) {
    return failure(raw, "Please check the highlighted fields.", toFieldErrors(parsed.error));
  }

  const data = parsed.data;
  const result = await insertFilterDefinition(
    {
      key: data.key,
      label: data.label,
      description: data.description === "" ? null : data.description,
      type: data.type,
      sourceKey: data.sourceKey === "" ? null : data.sourceKey,
      isActive: data.isActive,
      isMultiple: data.isMultiple,
      appliesToAll: data.appliesToAll,
      displayOrder: data.displayOrder,
    },
    data.options.map((option) => ({
      id: null,
      value: option.value,
      label: option.label,
      colorHex: option.colorHex === "" ? null : option.colorHex,
      displayOrder: option.displayOrder,
      isActive: option.isActive,
    })),
    data.categoryIds,
  );

  if (result.error) return mutationError(raw, result.error);

  revalidatePath("/admin/filters");
  revalidatePath("/products");
  redirect(`/admin/filters/${result.id}?saved=created`);
}

export async function updateFilterAction(
  _previousState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  await requirePermission("filters.manage", "/admin/filters");

  const raw = readFilterForm(formData);
  const parsed = filterFormSchema.safeParse(raw);
  if (!parsed.success) {
    return failure(raw, "Please check the highlighted fields.", toFieldErrors(parsed.error));
  }
  if (!uuidSchema.safeParse(raw.id).success) {
    return failure(raw, "That filter could not be found.");
  }

  const data = parsed.data;
  const error = await updateFilterDefinition(
    raw.id,
    {
      key: data.key,
      label: data.label,
      description: data.description === "" ? null : data.description,
      type: data.type,
      sourceKey: data.sourceKey === "" ? null : data.sourceKey,
      isActive: data.isActive,
      isMultiple: data.isMultiple,
      appliesToAll: data.appliesToAll,
      displayOrder: data.displayOrder,
    },
    data.options.map((option) => ({
      id: option.id === "" ? null : option.id,
      value: option.value,
      label: option.label,
      colorHex: option.colorHex === "" ? null : option.colorHex,
      displayOrder: option.displayOrder,
      isActive: option.isActive,
    })),
    data.categoryIds,
  );

  if (error) return mutationError(raw, error);

  revalidatePath("/admin/filters");
  revalidatePath(`/admin/filters/${raw.id}`);
  revalidatePath("/products");

  return {
    status: "success",
    message: "Filter saved.",
    fieldErrors: {},
    values: toFormValues(raw),
  };
}

export async function setFilterActiveAction(formData: FormData): Promise<void> {
  await requirePermission("filters.manage", "/admin/filters");

  const id = uuidSchema.safeParse(formString(formData, "id"));
  const isActive = formString(formData, "active") === "true";
  if (!id.success) redirect("/admin/filters?status=error");

  const error = await setFilterDefinitionActive(id.data, isActive);
  if (error) console.error("Filter status change failed", error.code ?? "unknown", error.message);

  revalidatePath("/admin/filters");
  revalidatePath("/products");
  redirect(`/admin/filters?status=${error ? "error" : "updated"}`);
}

export async function deleteFilterAction(formData: FormData): Promise<void> {
  await requirePermission("filters.manage", "/admin/filters");

  const id = uuidSchema.safeParse(formString(formData, "id"));
  if (!id.success) redirect("/admin/filters?status=error");

  const error = await deleteFilterDefinition(id.data);
  if (error) console.error("Filter delete failed", error.code ?? "unknown", error.message);

  revalidatePath("/admin/filters");
  revalidatePath("/products");
  redirect(`/admin/filters?status=${error ? "error" : "deleted"}`);
}
