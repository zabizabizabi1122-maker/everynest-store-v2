import Link from "next/link";

import type { CatalogProduct } from "@/lib/catalog";
import { formatPkr } from "@/lib/money";
import { describeAvailability, type AvailabilityTone } from "@/lib/storefront";

import { ProductImage } from "./product-image";
import { WishlistToggle } from "./wishlist-toggle";

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
  const onSale = product.compareAtPaisa !== null;
  const href = `/products/${product.slug}`;

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="relative aspect-[4/5] overflow-hidden bg-[color:var(--background)]">
        <Link href={href} className="absolute inset-0 block" aria-label={product.name}>
          <ProductImage
            src={product.imageUrl}
            alt={product.imageAlt ?? product.name}
            priority={priority}
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          />
        </Link>

        {onSale ? (
          <span className="absolute left-2.5 top-2.5 rounded-md bg-[color:var(--accent)] px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-[color:var(--foreground)] shadow-sm">
            Sale
          </span>
        ) : null}
        {availability.tone === "out" ? (
          <span className="absolute bottom-2.5 left-2.5 rounded-md bg-[color:var(--surface)]/95 px-2 py-1 text-[11px] font-semibold text-red-700 shadow-sm">
            Out of stock
          </span>
        ) : null}

        <div className="absolute right-2.5 top-2.5">
          <WishlistToggle productId={product.id} compact />
        </div>
      </div>

      <div className="flex flex-1 flex-col p-3.5">
        <Link href={href} className="block">
          <h3 className="line-clamp-2 font-heading text-base font-medium leading-6 text-foreground transition group-hover:text-[color:var(--primary)]">
            {product.name}
          </h3>
        </Link>

        <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-base font-semibold text-[color:var(--primary)]">
            {product.minPricePaisa === null
              ? "Price on request"
              : product.variantCount > 1
                ? `From ${formatPkr(product.minPricePaisa)}`
                : formatPkr(product.minPricePaisa)}
          </span>
          {onSale && product.compareAtPaisa !== null ? (
            <span className="text-sm text-[color:var(--muted)] line-through">
              {formatPkr(product.compareAtPaisa)}
            </span>
          ) : null}
        </div>

        <p className={`mt-1 text-xs font-medium ${availabilityClass[availability.tone]}`}>
          {availability.label}
        </p>

        <Link
          href={href}
          aria-label={`Choose options and add ${product.name} to cart`}
          className="mt-3 inline-flex items-center justify-center rounded-[10px] bg-[color:var(--primary)] px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-[color:var(--primary-hover)]"
        >
          Add to cart
        </Link>
      </div>
    </article>
  );
}
