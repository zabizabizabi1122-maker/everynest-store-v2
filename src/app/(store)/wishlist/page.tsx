import type { Metadata } from "next";
import Link from "next/link";

import { ProductImage } from "@/components/store/product-image";
import { secondaryButtonClass } from "@/components/ui/form";
import { formatPkr } from "@/lib/money";
import { loadWishlist } from "@/lib/wishlist-data";

import { removeWishlistItemAction } from "./actions";

export const metadata: Metadata = {
  title: "Wishlist · EveryNest",
  description: "Products you saved at EveryNest.",
};

export default async function WishlistPage() {
  const entries = await loadWishlist();

  return (
    <div className="mx-auto w-full max-w-5xl px-6 pb-20 pt-10">
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
        <Link href="/" className="hover:text-[color:var(--brand)]">Home</Link>
        <span aria-hidden="true">/</span>
        <span className="font-medium text-neutral-800">Wishlist</span>
      </nav>

      <header className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--brand)]">
            Level 11 · Optional features
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">My wishlist</h1>
          <p className="mt-1.5 text-sm text-neutral-600">
            {entries.length === 0
              ? "You have not saved any products yet."
              : `${entries.length} saved ${entries.length === 1 ? "product" : "products"}.`}
          </p>
        </div>
        <Link href="/products" className={secondaryButtonClass}>
          Browse products
        </Link>
      </header>

      {entries.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-neutral-200 bg-neutral-50 p-10 text-center">
          <p className="text-sm text-neutral-600">
            Use the heart button on a product page to save it here for later.
          </p>
          <Link href="/products" className="mt-4 inline-block font-medium text-[color:var(--brand)] hover:underline">
            Explore the catalogue →
          </Link>
        </div>
      ) : (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {entries.map((entry) => {
            const product = entry.product;
            if (!product) {
              return (
                <li key={entry.id} className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
                  <p className="text-sm text-neutral-600">This product is no longer available.</p>
                  <form action={removeWishlistItemAction} className="mt-3">
                    <input type="hidden" name="itemId" value={entry.id} />
                    <button type="submit" className="text-sm font-medium text-rose-700 hover:underline">
                      Remove
                    </button>
                  </form>
                </li>
              );
            }

            return (
              <li key={entry.id} className="flex flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
                <Link href={`/products/${product.slug}`} className="relative aspect-square">
                  <ProductImage src={product.imageUrl} alt={product.name} />
                </Link>
                <div className="flex flex-1 flex-col p-4">
                  <Link
                    href={`/products/${product.slug}`}
                    className="font-semibold text-neutral-900 hover:text-[color:var(--brand)]"
                  >
                    {product.name}
                  </Link>
                  <p className="mt-1 text-sm text-neutral-600">
                    {product.minPricePaisa !== null ? formatPkr(product.minPricePaisa) : "Price on request"}
                  </p>
                  <p className={`mt-1 text-xs ${product.inStock ? "text-emerald-700" : "text-neutral-500"}`}>
                    {product.inStock ? "In stock" : "Currently unavailable"}
                  </p>
                  <form action={removeWishlistItemAction} className="mt-auto pt-4">
                    <input type="hidden" name="itemId" value={entry.id} />
                    <button type="submit" className="text-sm font-medium text-rose-700 hover:underline">
                      Remove
                    </button>
                  </form>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
