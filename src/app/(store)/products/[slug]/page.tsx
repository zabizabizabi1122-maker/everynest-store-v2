import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AddToCart } from "@/components/store/add-to-cart";
import { ProductGallery } from "@/components/store/product-gallery";
import { ProductCard } from "@/components/store/product-card";
import { ProductReviews } from "@/components/store/product-reviews";
import { loadProductBySlug } from "@/lib/catalog";
import { formatPkr } from "@/lib/money";
import { loadApprovedReviews } from "@/lib/review-data";
import { displayPricePaisa } from "@/lib/storefront";
import { slugSchema } from "@/lib/validators";

export const metadata: Metadata = {
  title: "Product details · EveryNest",
};

interface ProductPageProps {
  params: Promise<{ slug: string }>;
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  if (!slugSchema.safeParse(slug).success) notFound();

  const detail = await loadProductBySlug(slug);
  if (!detail) notFound();

  const { product, category, schema, images, variants, related } = detail;
  const reviews = await loadApprovedReviews(product.id);
  const galleryImages = images.map((image) => ({ url: image.url, altText: image.alt_text }));
  const prices = variants.map(displayPricePaisa);
  const minPrice = prices.length > 0 ? Math.min(...prices) : null;
  const regularPrices = variants.map((variant) => variant.pricePaisa);
  const minRegular = regularPrices.length > 0 ? Math.min(...regularPrices) : null;

  return (
    <div className="mx-auto w-full max-w-6xl px-6 pb-20 pt-8">
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-xs text-[color:var(--muted)]">
        <Link href="/" className="hover:text-[color:var(--primary)]">Home</Link>
        <span aria-hidden="true">/</span>
        <Link href="/products" className="hover:text-[color:var(--primary)]">Products</Link>
        {category ? (
          <>
            <span aria-hidden="true">/</span>
            <Link href={`/products?category=${encodeURIComponent(category.id)}`} className="hover:text-[color:var(--primary)]">
              {category.name}
            </Link>
          </>
        ) : null}
        <span aria-hidden="true">/</span>
        <span className="truncate font-medium text-[color:var(--foreground)]">{product.name}</span>
      </nav>

      <div className="mt-6 grid gap-10 lg:grid-cols-2">
        <ProductGallery images={galleryImages} name={product.name} />

        <div>
          {product.brand ? (
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">
              {product.brand}
            </p>
          ) : null}
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">{product.name}</h1>

          {category ? (
            <p className="mt-2 text-sm text-[color:var(--muted)]">
              Part of{" "}
              <Link href={`/products?category=${encodeURIComponent(category.id)}`} className="font-medium text-[color:var(--primary)] hover:underline">
                {category.name}
              </Link>
            </p>
          ) : null}

          <div className="mt-5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            {minPrice !== null ? (
              <>
                <span className="text-3xl font-bold text-[color:var(--primary)]">
                  {variants.length > 1 ? "From " : ""}{formatPkr(minPrice)}
                </span>
                {minRegular !== null && minRegular > minPrice ? (
                  <span className="text-base text-neutral-400 line-through">{formatPkr(minRegular)}</span>
                ) : null}
              </>
            ) : (
              <span className="text-base text-[color:var(--muted)]">Price on request</span>
            )}
          </div>

          <p className="mt-5 whitespace-pre-line text-sm leading-7 text-[color:var(--muted)]">
            {product.description?.trim()
              ? product.description
              : "A carefully selected product from the EveryNest catalogue."}
          </p>

          <div className="mt-7">
            <AddToCart
              productName={product.name}
              imageUrl={images[0]?.url ?? null}
              variants={variants}
              schema={schema}
            />
          </div>

          <ul className="mt-6 grid gap-3 text-sm text-[color:var(--muted)] sm:grid-cols-2">
            <li className="flex items-start gap-2.5 rounded-xl border border-[color:var(--border)] bg-[color:var(--background)] p-3">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-[color:var(--primary)]">
                <path d="M3 7h11v10H3zM14 10h4l3 3v4h-7z" />
                <circle cx="7" cy="18" r="2" />
                <circle cx="17.5" cy="18" r="2" />
              </svg>
              Delivered across Pakistan
            </li>
            <li className="flex items-start gap-2.5 rounded-xl border border-[color:var(--border)] bg-[color:var(--background)] p-3">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-[color:var(--primary)]">
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <path d="M3 10h18M7 15h4" />
              </svg>
              Cash on delivery available
            </li>
          </ul>
        </div>
      </div>

      <ProductReviews reviews={reviews} />

      {related.length > 0 ? (
        <section aria-labelledby="related-heading" className="mt-20">
          <h2 id="related-heading" className="text-2xl font-semibold tracking-tight">
            More from this category
          </h2>
          <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((item) => (
              <ProductCard key={item.id} product={item} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
