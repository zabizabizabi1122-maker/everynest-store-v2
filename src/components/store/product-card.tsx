import Link from "next/link";

import type { CatalogProduct } from "@/lib/catalog";
import { formatPkr } from "@/lib/money";
import { describeAvailability, type AvailabilityTone } from "@/lib/storefront";

import { ProductImage } from "./product-image";

const availabilityClass: Record<AvailabilityTone, string> = {
  in: "text-emerald-700",
  low: "text-amber-700",
  out: "text-red-700",
};

/** Compact catalogue tile used on the homepage, listing and related section. */
export function ProductCard({
  product,
  priority = false,
}: {
  product: CatalogProduct;
  priority?: boolean;
}) {
  const availability = describeAvailability(product.stock);

  return (
    <Link
      href={`/products/${product.slug}`}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--brand)]"
    >
      <div className="relative aspect-square overflow-hidden bg-neutral-100">
        <ProductImage
          src={product.imageUrl}
          alt={product.imageAlt ?? product.name}
          priority={priority}
        />
        {availability.tone === "out" ? (
          <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold text-red-700 shadow-sm">
            Out of stock
          </span>
        ) : null}
        {availability.tone === "low" ? (
          <span className="absolute left-3 top-3 rounded-full bg-amber-600 px-2.5 py-1 text-xs font-semibold text-white shadow-sm">
            {availability.label}
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col p-4">
        {product.brand ? (
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
            {product.brand}
          </p>
        ) : null}
        <h3 className="mt-1 line-clamp-2 text-sm font-semibold leading-5 text-neutral-900">
          {product.name}
        </h3>

        <p className="mt-3 text-base font-bold text-[color:var(--brand)]">
          {product.minPricePaisa === null ? (
            "Price on request"
          ) : (
            <>
              {product.variantCount > 1 ? <span className="mr-1 text-xs font-medium text-neutral-500">From</span> : null}
              {formatPkr(product.minPricePaisa)}
            </>
          )}
        </p>
        <p className={`mt-1 text-xs font-medium ${availabilityClass[availability.tone]}`}>
          {availability.label}
        </p>
      </div>
    </Link>
  );
}
