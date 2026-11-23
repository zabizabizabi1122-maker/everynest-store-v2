"use client";

import { useState } from "react";

import { ProductImage } from "./product-image";

export interface GalleryImage {
  url: string;
  altText: string | null;
}

/** Main product image with clickable thumbnails; falls back to a placeholder. */
export function ProductGallery({
  images,
  name,
}: {
  images: readonly GalleryImage[];
  name: string;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = images[activeIndex] ?? null;

  return (
    <div>
      <div className="relative aspect-square overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[color:var(--background)]">
        <div key={activeIndex} className="animate-fade-in absolute inset-0">
          <ProductImage
            src={active?.url ?? null}
            alt={active?.altText ?? name}
            sizes="(max-width: 1024px) 100vw, 50vw"
            priority
          />
        </div>
      </div>

      {images.length > 1 ? (
        <div className="mt-3 flex gap-3 overflow-x-auto pb-1">
          {images.map((image, index) => (
            <button
              key={`${image.url}-${index}`}
              type="button"
              onClick={() => setActiveIndex(index)}
              aria-label={`View image ${index + 1} of ${images.length}`}
              aria-pressed={index === activeIndex}
              className={`relative size-20 shrink-0 overflow-hidden rounded-xl border-2 bg-[color:var(--background)] transition hover:scale-[1.03] active:scale-95 motion-reduce:hover:scale-100 motion-reduce:active:scale-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--primary)] ${
                index === activeIndex ? "border-[color:var(--brand)]" : "border-transparent hover:border-[color:var(--border)]"
              }`}
            >
              <ProductImage src={image.url} alt="" sizes="80px" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
