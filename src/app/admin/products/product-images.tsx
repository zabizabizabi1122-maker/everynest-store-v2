/* eslint-disable @next/next/no-img-element -- Gallery URLs come from Supabase Storage at runtime; next/image host config depends on deployment env. */

import { secondaryButtonClass } from "@/components/ui/form";
import type { ProductImageRow } from "@/lib/product-data";

import { moveProductImageAction, removeProductImageAction, uploadProductImageAction } from "./actions";

const IMAGE_ERRORS: Record<string, string> = {
  file: "Choose a JPEG, PNG or WebP image smaller than 5 MB.",
  type: "Only valid JPEG, PNG and WebP images are allowed.",
  upload: "The image could not be uploaded. Please try again.",
  save: "The image was uploaded but could not be added to the gallery.",
  missing: "That image could not be found. Reload the page and try again.",
};

interface ProductImagesProps {
  productId: string;
  images: readonly ProductImageRow[];
  imageError?: string;
}

const tinyButtonClass =
  "rounded-lg border border-neutral-300 bg-white px-2.5 py-1 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--brand)] disabled:cursor-not-allowed disabled:opacity-50";

/** Server-rendered gallery manager: uploads, order and removal are native forms. */
export function ProductImages({ productId, images, imageError }: ProductImagesProps) {
  const message = imageError ? IMAGE_ERRORS[imageError] : undefined;

  return (
    <section aria-labelledby="gallery-heading" className="rounded-2xl border border-neutral-200 bg-white p-5">
      <h3 id="gallery-heading" className="text-base font-semibold text-neutral-900">
        Gallery images ({images.length})
      </h3>
      <p className="mt-1 text-sm text-neutral-600">
        JPEG, PNG or WebP up to 5 MB. The first image is the product thumbnail.
      </p>

      {message ? (
        <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {message}
        </p>
      ) : null}

      {images.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-neutral-300 px-4 py-5 text-center text-sm text-neutral-500">
          No images yet. Upload one to give the product a thumbnail.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-neutral-100 rounded-xl border border-neutral-200">
          {images.map((image, index) => (
            <li key={image.id} className="flex flex-wrap items-center gap-4 p-3">
              <img
                src={image.url}
                alt={image.alt_text ?? `Product image ${index + 1}`}
                className="size-16 rounded-lg border border-neutral-200 bg-neutral-100 object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-neutral-900">{image.alt_text || `Image ${index + 1}`}</p>
                <p className="text-xs text-neutral-500">Position {index + 1}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <form action={moveProductImageAction}>
                  <input type="hidden" name="productId" value={productId} />
                  <input type="hidden" name="imageId" value={image.id} />
                  <input type="hidden" name="direction" value="up" />
                  <button type="submit" disabled={index === 0} className={tinyButtonClass}>
                    ↑ Up
                  </button>
                </form>
                <form action={moveProductImageAction}>
                  <input type="hidden" name="productId" value={productId} />
                  <input type="hidden" name="imageId" value={image.id} />
                  <input type="hidden" name="direction" value="down" />
                  <button type="submit" disabled={index === images.length - 1} className={tinyButtonClass}>
                    ↓ Down
                  </button>
                </form>
                <form action={removeProductImageAction}>
                  <input type="hidden" name="productId" value={productId} />
                  <input type="hidden" name="imageId" value={image.id} />
                  <button type="submit" className="rounded-lg px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600">
                    Remove
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form action={uploadProductImageAction} encType="multipart/form-data" className="mt-5 grid gap-3 rounded-xl border border-neutral-200 bg-neutral-50/70 p-4 sm:grid-cols-[1fr,1fr,auto] sm:items-end">
        <div>
          <label htmlFor="image-file" className="block text-xs font-semibold text-neutral-700">
            Image file
          </label>
          <input
            id="image-file"
            name="image"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            required
            className="mt-1.5 block w-full text-xs text-neutral-700 file:mr-3 file:rounded-lg file:border-0 file:bg-neutral-200 file:px-3 file:py-2 file:text-xs file:font-medium file:text-neutral-800 hover:file:bg-neutral-300"
          />
        </div>
        <div>
          <label htmlFor="image-alt" className="block text-xs font-semibold text-neutral-700">
            Alt text (optional)
          </label>
          <input
            id="image-alt"
            name="altText"
            type="text"
            maxLength={120}
            placeholder="Front view of the shirt"
            className="mt-1.5 block w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-[color:var(--brand)] focus:ring-2 focus:ring-[color:var(--brand)]/20"
          />
        </div>
        <input type="hidden" name="productId" value={productId} />
        <button type="submit" className={`${secondaryButtonClass} h-fit`}>
          Upload image
        </button>
      </form>
    </section>
  );
}
