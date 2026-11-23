"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requirePermission } from "@/lib/auth";
import { loadCategoryTree } from "@/lib/category-data";
import { effectiveAttributes } from "@/lib/category-schema";
import { formString, toFieldErrors, type FormActionState } from "@/lib/form-state";
import { conflictingSkus, loadProductDetail } from "@/lib/product-data";
import { createClient } from "@/lib/supabase/server";
import { slugSchema, uuidSchema } from "@/lib/validators";
import { parseVariantRows } from "@/lib/variant-attributes";

/**
 * Level 5 Server Actions.
 *
 * Every action re-checks the session and role, validates input with Zod, and
 * relies on the Level 1 column grants + RLS as the final authority. In
 * particular, `stock` is never sent: application roles have no grant on that
 * column, and stock can only move through the trusted RPCs built in Level 6.
 */

const productFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters.")
    .max(100, "Name must be 100 characters or fewer."),
  slug: slugSchema,
  categoryId: uuidSchema,
  brand: z.string().trim().max(100, "Brand must be 100 characters or fewer."),
  description: z.string().trim().max(2000, "Description must be 2000 characters or fewer."),
});

interface RawProductForm {
  name: string;
  slug: string;
  categoryId: string;
  brand: string;
  description: string;
  variants: string;
  isFeatured: boolean;
  isActive: boolean;
}

function readProductForm(formData: FormData): RawProductForm {
  return {
    name: formString(formData, "name"),
    slug: formString(formData, "slug"),
    categoryId: formString(formData, "categoryId"),
    brand: formString(formData, "brand"),
    description: formString(formData, "description"),
    variants: formString(formData, "variants"),
    isFeatured: formData.has("isFeatured"),
    isActive: formData.has("isActive"),
  };
}

function toFormValues(raw: RawProductForm): Record<string, string> {
  return {
    name: raw.name,
    slug: raw.slug,
    categoryId: raw.categoryId,
    brand: raw.brand,
    description: raw.description,
    variants: raw.variants,
    isFeatured: raw.isFeatured ? "true" : "false",
    isActive: raw.isActive ? "true" : "false",
  };
}

function parseVariantsJson(text: string): { ok: true; value: unknown } | { ok: false; message: string } {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false, message: "The variant data could not be read. Please try again." };
  }
}

function duplicateSlugMessage(): FormActionState {
  return {
    status: "error",
    message: "That slug is already in use. Choose a different one.",
    fieldErrors: { slug: ["Slug must be unique."] },
  };
}

async function revalidateProduct(productId?: string): Promise<void> {
  revalidatePath("/admin/products");
  if (productId) revalidatePath(`/admin/products/${productId}`);
}

/** Resolves the effective schema of a category, including inherited attributes. */
async function schemaForCategory(categoryId: string): Promise<
  | { ok: true; attributes: import("@/lib/category-schema").CategoryAttribute[] }
  | { ok: false; message: string }
> {
  const categories = await loadCategoryTree();
  const category = categories.find((item) => item.id === categoryId);

  if (!category || !category.is_active) {
    return { ok: false, message: "Choose an active category." };
  }

  const { attributes, conflicts } = effectiveAttributes(categories, categoryId);

  if (conflicts.length > 0) {
    return {
      ok: false,
      message: `This category has conflicting inherited attributes: ${conflicts.join(", ")}. Fix them in Category management first.`,
    };
  }

  return { ok: true, attributes };
}

export async function createProductAction(
  _previousState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  await requirePermission("products.manage", "/admin/products/new");

  const raw = readProductForm(formData);
  const parsed = productFormSchema.safeParse(raw);
  const variantsJson = parseVariantsJson(raw.variants);

  if (!parsed.success || !variantsJson.ok) {
    return {
      status: "error",
      message: "Please check the highlighted fields.",
      fieldErrors: {
        ...(parsed.success ? {} : toFieldErrors(parsed.error)),
        ...(variantsJson.ok ? {} : { variants: [variantsJson.message] }),
      },
      values: toFormValues(raw),
    };
  }

  const schema = await schemaForCategory(parsed.data.categoryId);

  if (!schema.ok) {
    return {
      status: "error",
      message: schema.message,
      fieldErrors: { categoryId: [schema.message] },
      values: toFormValues(raw),
    };
  }

  if (!Array.isArray(variantsJson.value) || variantsJson.value.length === 0) {
    const message = "Add at least one variant before saving the product.";
    return {
      status: "error",
      message,
      fieldErrors: { variants: [message] },
      values: toFormValues(raw),
    };
  }

  const variants = parseVariantRows(variantsJson.value, schema.attributes);

  if (!variants.success) {
    return {
      status: "error",
      message: variants.message,
      fieldErrors: { variants: [variants.message] },
      values: toFormValues(raw),
    };
  }

  const clashes = await conflictingSkus(variants.data.map((variant) => variant.sku));

  if (clashes.length > 0) {
    const message = `SKU already in use: ${clashes.join(", ")}.`;
    return {
      status: "error",
      message,
      fieldErrors: { variants: [message] },
      values: toFormValues(raw),
    };
  }

  const supabase = await createClient();
  const { data: product, error: productError } = await supabase
    .from("products")
    .insert({
      name: parsed.data.name,
      slug: parsed.data.slug,
      category_id: parsed.data.categoryId,
      brand: parsed.data.brand || null,
      description: parsed.data.description || null,
      is_featured: raw.isFeatured,
      is_active: raw.isActive,
    })
    .select("id")
    .single();

  if (productError || !product) {
    if (productError?.code === "23505") {
      return { ...duplicateSlugMessage(), values: toFormValues(raw) };
    }

    console.error("Product create failed", productError?.message ?? "no row returned");
    return {
      status: "error",
      message: "We could not create the product. Please try again.",
      fieldErrors: {},
      values: toFormValues(raw),
    };
  }

  const { error: variantsError } = await supabase.from("product_variants").insert(
    variants.data.map((variant) => ({
      product_id: product.id,
      sku: variant.sku,
      attributes: variant.attributes,
      price_paisa: variant.pricePaisa,
      sale_price_paisa: variant.salePricePaisa,
      reorder_level: variant.reorderLevel,
      is_active: variant.isActive,
    })),
  );

  if (variantsError) {
    console.error("Variant create failed", variantsError.message);
    return {
      status: "error",
      message: "The product was created but its variants could not be saved. Edit the product to add them.",
      fieldErrors: {},
      values: toFormValues(raw),
    };
  }

  await revalidateProduct(product.id);
  redirect(`/admin/products/${product.id}?saved=created`);
}

export async function updateProductAction(
  _previousState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  await requirePermission("products.manage", "/admin/products");

  const raw = readProductForm(formData);
  const id = uuidSchema.safeParse(formString(formData, "id"));
  const parsed = productFormSchema.safeParse(raw);
  const variantsJson = parseVariantsJson(raw.variants);

  if (!id.success) {
    return {
      status: "error",
      message: "That product could not be found.",
      fieldErrors: {},
      values: toFormValues(raw),
    };
  }

  if (!parsed.success || !variantsJson.ok) {
    return {
      status: "error",
      message: "Please check the highlighted fields.",
      fieldErrors: {
        ...(parsed.success ? {} : toFieldErrors(parsed.error)),
        ...(variantsJson.ok ? {} : { variants: [variantsJson.message] }),
      },
      values: toFormValues(raw),
    };
  }

  const { product, variants: existingVariants } = await loadProductDetail(id.data);

  if (!product) {
    return {
      status: "error",
      message: "That product could not be found.",
      fieldErrors: {},
      values: toFormValues(raw),
    };
  }

  // Once variants exist the category is locked: changing it would reinterpret
  // every stored attribute value against a different schema.
  if (existingVariants.length > 0 && product.category_id !== parsed.data.categoryId) {
    const message = "The category cannot be changed because this product already has variants. Archive it and create a replacement instead.";
    return {
      status: "error",
      message,
      fieldErrors: { categoryId: [message] },
      values: toFormValues(raw),
    };
  }

  const schema = await schemaForCategory(parsed.data.categoryId);

  if (!schema.ok) {
    return {
      status: "error",
      message: schema.message,
      fieldErrors: { categoryId: [schema.message] },
      values: toFormValues(raw),
    };
  }

  if (!Array.isArray(variantsJson.value)) {
    return {
      status: "error",
      message: "The variant data could not be read. Please try again.",
      fieldErrors: { variants: ["The variant data could not be read."] },
      values: toFormValues(raw),
    };
  }

  const variants = parseVariantRows(variantsJson.value, schema.attributes);

  if (!variants.success) {
    return {
      status: "error",
      message: variants.message,
      fieldErrors: { variants: [variants.message] },
      values: toFormValues(raw),
    };
  }

  const submittedIds = variants.data.flatMap((variant) => (variant.id ? [variant.id] : []));
  const ownedIds = new Set(existingVariants.map((variant) => variant.id));

  if (submittedIds.some((variantId) => !ownedIds.has(variantId))) {
    return {
      status: "error",
      message: "One of the variants does not belong to this product.",
      fieldErrors: { variants: ["Reload the page and try again."] },
      values: toFormValues(raw),
    };
  }

  const newSkus = variants.data
    .filter((variant) => !variant.id || variant.sku !== existingVariants.find((item) => item.id === variant.id)?.sku)
    .map((variant) => variant.sku);
  const clashes = await conflictingSkus(newSkus);

  if (clashes.length > 0) {
    const message = `SKU already in use: ${clashes.join(", ")}.`;
    return {
      status: "error",
      message,
      fieldErrors: { variants: [message] },
      values: toFormValues(raw),
    };
  }

  const supabase = await createClient();
  const { error: productError } = await supabase
    .from("products")
    .update({
      name: parsed.data.name,
      slug: parsed.data.slug,
      category_id: parsed.data.categoryId,
      brand: parsed.data.brand || null,
      description: parsed.data.description || null,
      is_featured: raw.isFeatured,
      is_active: raw.isActive,
    })
    .eq("id", id.data)
    .select("id");

  if (productError) {
    if (productError.code === "23505") {
      return { ...duplicateSlugMessage(), values: toFormValues(raw) };
    }

    console.error("Product update failed", productError.message);
    return {
      status: "error",
      message: "We could not save the product. Please try again.",
      fieldErrors: {},
      values: toFormValues(raw),
    };
  }

  for (const variant of variants.data) {
    const values = {
      sku: variant.sku,
      attributes: variant.attributes,
      price_paisa: variant.pricePaisa,
      sale_price_paisa: variant.salePricePaisa,
      reorder_level: variant.reorderLevel,
      is_active: variant.isActive,
    };

    const { error } = variant.id
      ? await supabase.from("product_variants").update(values).eq("id", variant.id).eq("product_id", id.data).select("id")
      : await supabase.from("product_variants").insert({ ...values, product_id: id.data });

    if (error) {
      console.error("Variant save failed", error.message);
      await revalidateProduct(id.data);
      return {
        status: "error",
        message: "The product was saved but one variant could not be updated. Check the SKU and attribute values.",
        fieldErrors: {},
        values: toFormValues(raw),
      };
    }
  }

  await revalidateProduct(id.data);

  return {
    status: "success",
    message: "Product and variants saved.",
    fieldErrors: {},
    values: toFormValues(raw),
  };
}

/** Archive or reactivate a product. No product is ever hard-deleted. */
export async function setProductActiveAction(formData: FormData): Promise<void> {
  await requirePermission("products.manage", "/admin/products");

  const id = uuidSchema.safeParse(formString(formData, "id"));
  const isActive = formString(formData, "active") === "true";

  if (!id.success) {
    redirect("/admin/products?status=error");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("products")
    .update({ is_active: isActive })
    .eq("id", id.data)
    .select("id");

  if (error) console.error("Product status change failed", error.message);

  await revalidateProduct(id.data);
  redirect(`/admin/products?status=${error ? "error" : "updated"}`);
}

// ---------------------------------------------------------------------------
// Product images — `product-images` Storage bucket + product_images rows
// ---------------------------------------------------------------------------

const IMAGE_BUCKET = "product-images";
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** Sniffs the file signature instead of trusting the uploaded filename. */
function detectImageMime(bytes: Uint8Array): string | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";

  if (
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) {
    return "image/png";
  }

  if (bytes.length >= 12) {
    const riff = String.fromCharCode(...bytes.slice(0, 4));
    const webp = String.fromCharCode(...bytes.slice(8, 12));
    if (riff === "RIFF" && webp === "WEBP") return "image/webp";
  }

  return null;
}

function imageObjectPath(url: string, productId: string): string | null {
  const marker = `/storage/v1/object/public/${IMAGE_BUCKET}/`;
  const at = url.indexOf(marker);

  if (at < 0) return null;

  const path = url.slice(at + marker.length).split(/[?#]/, 1)[0];

  if (!path.startsWith(`${productId}/`) || path.includes("..") || path.includes("\\")) {
    return null;
  }

  return path;
}

function imageRedirect(productId: string, errorCode?: string): never {
  const query = errorCode ? `?imageError=${errorCode}` : "";
  redirect(`/admin/products/${productId}${query}`);
}

export async function uploadProductImageAction(formData: FormData): Promise<void> {
  await requirePermission("products.manage", "/admin/products");

  const id = uuidSchema.safeParse(formString(formData, "productId"));

  if (!id.success) {
    redirect("/admin/products?status=error");
  }

  const supabase = await createClient();
  const { data: product } = await supabase
    .from("products")
    .select("id")
    .eq("id", id.data)
    .maybeSingle();

  if (!product) {
    redirect("/admin/products?status=error");
  }

  const file = formData.get("image");

  if (!(file instanceof File) || file.size === 0 || file.size > MAX_IMAGE_BYTES) {
    await revalidateProduct(id.data);
    imageRedirect(id.data, "file");
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const detected = detectImageMime(bytes);

  if (!detected || detected !== file.type || !IMAGE_EXTENSIONS[detected]) {
    await revalidateProduct(id.data);
    imageRedirect(id.data, "type");
  }

  const path = `${id.data}/${randomUUID()}.${IMAGE_EXTENSIONS[detected]}`;
  const { error: uploadError } = await supabase.storage
    .from(IMAGE_BUCKET)
    .upload(path, bytes, { contentType: detected, upsert: false });

  if (uploadError) {
    console.error("Image upload failed", uploadError.message);
    await revalidateProduct(id.data);
    imageRedirect(id.data, "upload");
  }

  const { data: publicUrl } = supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path);

  const { data: last } = await supabase
    .from("product_images")
    .select("sort_order")
    .eq("product_id", id.data)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error: insertError } = await supabase.from("product_images").insert({
    product_id: id.data,
    url: publicUrl.publicUrl,
    alt_text: formString(formData, "altText").trim() || null,
    sort_order: (last?.sort_order ?? -1) + 1,
  });

  if (insertError) {
    console.error("Image row insert failed", insertError.message);
    await supabase.storage.from(IMAGE_BUCKET).remove([path]);
    await revalidateProduct(id.data);
    imageRedirect(id.data, "save");
  }

  await revalidateProduct(id.data);
  imageRedirect(id.data);
}

export async function removeProductImageAction(formData: FormData): Promise<void> {
  await requirePermission("products.manage", "/admin/products");

  const productId = uuidSchema.safeParse(formString(formData, "productId"));
  const imageId = uuidSchema.safeParse(formString(formData, "imageId"));

  if (!productId.success || !imageId.success) {
    redirect("/admin/products?status=error");
  }

  const supabase = await createClient();
  const { data: image } = await supabase
    .from("product_images")
    .select("id, url")
    .eq("id", imageId.data)
    .eq("product_id", productId.data)
    .maybeSingle();

  if (!image) {
    await revalidateProduct(productId.data);
    imageRedirect(productId.data, "missing");
  }

  const path = imageObjectPath(image.url, productId.data);

  if (path) {
    const { error: storageError } = await supabase.storage.from(IMAGE_BUCKET).remove([path]);
    if (storageError) console.error("Image removal failed", storageError.message);
  }

  const { error } = await supabase.from("product_images").delete().eq("id", image.id);

  if (error) console.error("Image row delete failed", error.message);

  await revalidateProduct(productId.data);
  imageRedirect(productId.data);
}

export async function moveProductImageAction(formData: FormData): Promise<void> {
  await requirePermission("products.manage", "/admin/products");

  const productId = uuidSchema.safeParse(formString(formData, "productId"));
  const imageId = uuidSchema.safeParse(formString(formData, "imageId"));
  const direction = formString(formData, "direction") === "down" ? 1 : -1;

  if (!productId.success || !imageId.success) {
    redirect("/admin/products?status=error");
  }

  const supabase = await createClient();
  const { data: images } = await supabase
    .from("product_images")
    .select("id, sort_order")
    .eq("product_id", productId.data)
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });

  const ordered = images ?? [];
  const index = ordered.findIndex((image) => image.id === imageId.data);
  const target = index + direction;

  if (index < 0 || target < 0 || target >= ordered.length) {
    await revalidateProduct(productId.data);
    imageRedirect(productId.data);
  }

  [ordered[index], ordered[target]] = [ordered[target], ordered[index]];

  for (const [position, image] of ordered.entries()) {
    const { error } = await supabase
      .from("product_images")
      .update({ sort_order: position })
      .eq("id", image.id)
      .eq("product_id", productId.data);

    if (error) {
      console.error("Image reorder failed", error.message);
      break;
    }
  }

  await revalidateProduct(productId.data);
  imageRedirect(productId.data);
}

/** Extracts a Storage object path from a public product-images URL. */
function productImageStoragePath(url: string): string | null {
  const marker = "/storage/v1/object/public/product-images/";
  const index = url.indexOf(marker);
  if (index === -1) return null;

  const raw = url.slice(index + marker.length).split("?")[0];
  if (!raw) return null;

  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/**
 * Permanently deletes a product through the trusted RPC. The RPC refuses rows
 * with order or stock history; Storage objects are removed only after the
 * database delete succeeds, so a failed guard leaves the gallery intact.
 */
export async function deleteProductAction(formData: FormData): Promise<void> {
  await requirePermission("products.delete", "/admin/products");

  const id = uuidSchema.safeParse(formString(formData, "id"));
  if (!id.success) redirect("/admin/products?status=delete-error");

  const supabase = await createClient();
  const { data: images } = await supabase
    .from("product_images")
    .select("url")
    .eq("product_id", id.data);

  const { error } = await supabase.rpc("delete_product", { p_product_id: id.data });

  if (error) {
    console.error("Product delete failed", error.code, error.message);
    const reason = encodeURIComponent(error.message.slice(0, 180));
    redirect(`/admin/products?status=delete-blocked&reason=${reason}`);
  }

  const paths = (images ?? [])
    .map((image) => productImageStoragePath(image.url))
    .filter((path): path is string => path !== null);

  if (paths.length > 0) {
    const { error: storageError } = await supabase.storage
      .from("product-images")
      .remove(paths);
    if (storageError) console.error("Product image cleanup failed", storageError.message);
  }

  revalidatePath("/admin/products");
  revalidatePath("/products");
  redirect("/admin/products?status=deleted");
}
