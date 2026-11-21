import type { Metadata } from "next";
import Link from "next/link";

import { HeroCarousel } from "@/components/store/hero-carousel";
import { ProductCard } from "@/components/store/product-card";
import { ProductImage } from "@/components/store/product-image";
import { primaryButtonClass, secondaryButtonClass } from "@/components/ui/form";
import { loadFeaturedProducts, loadLatestProducts, loadPublicCategories } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "EveryNest — clothes, stationery and shoes",
  description:
    "Discover everyday clothes, stationery, shoes and more at EveryNest. Clear prices, real stock and nationwide delivery across Pakistan.",
};

/** Local branded placeholders used to give each category tile a visual cue. */
const CATEGORY_IMAGES: Record<string, string> = {
  clothes: "/products/classic-cotton-shirt.jpg",
  stationery: "/products/gel-pen-set.jpg",
  shoes: "/products/everyday-sneakers.jpg",
  bags: "/products/canvas-backpack.jpg",
  accessories: "/products/leather-card-wallet.jpg",
  "home-and-living": "/products/ceramic-coffee-mug.jpg",
  "mens-shirts": "/products/oxford-formal-shirt.jpg",
  notebooks: "/products/a5-ruled-notebook.jpg",
  sneakers: "/products/everyday-sneakers.jpg",
  "t-shirts": "/products/essential-cotton-tshirt.jpg",
};

const BENEFITS = [
  {
    title: "Nationwide delivery",
    subtitle: "Across Pakistan",
    icon: (
      <>
        <path d="M3 7h11v10H3zM14 10h4l3 3v4h-7z" />
        <circle cx="7" cy="18" r="2" />
        <circle cx="17.5" cy="18" r="2" />
      </>
    ),
  },
  {
    title: "Cash on delivery",
    subtitle: "Pay when it arrives",
    icon: (
      <>
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <path d="M2 10h20M6 15h4" />
      </>
    ),
  },
  {
    title: "Transparent prices",
    subtitle: "No hidden charges",
    icon: (
      <>
        <path d="M12 3v18M16 7.5c0-1.5-1.8-2.5-4-2.5s-4 1-4 2.5 1.8 2.5 4 2.5 4 1 4 2.5S14.2 17 12 17s-4-1-4-2.5" />
      </>
    ),
  },
  {
    title: "Live stock updates",
    subtitle: "Know what's available",
    icon: (
      <>
        <path d="M20 6 9 17l-5-5" />
      </>
    ),
  },
] as const;

const PROMISES = [
  {
    title: "Curated essentials",
    body: "A focused catalogue of clothes, stationery and everyday goods — chosen to be useful, not overwhelming.",
    icon: <path d="m12 3 2.6 5.5 6 .8-4.4 4.2 1.1 6-5.3-2.9-5.3 2.9 1.1-6L3.4 9.3l6-.8z" />,
  },
  {
    title: "Honest value",
    body: "Clear paisa pricing and visible sale prices, so you always know exactly what you are paying.",
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v10M9 10h6M9 14h6" />
      </>
    ),
  },
  {
    title: "Simple checkout",
    body: "Choose your size or colour, add to cart and check out in a few steps. No account required to browse.",
    icon: (
      <>
        <path d="M5 12h14M13 6l6 6-6 6" />
      </>
    ),
  },
] as const;

function ProductSection({
  id,
  title,
  description,
  products,
}: {
  id: string;
  title: string;
  description: string;
  products: Awaited<ReturnType<typeof loadLatestProducts>>;
}) {
  return (
    <section aria-labelledby={id} className="mt-16">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--brand)]">
            From the catalogue
          </p>
          <h2 id={id} className="mt-1.5 text-2xl font-semibold tracking-tight">
            {title}
          </h2>
          <p className="mt-1.5 text-sm text-neutral-600">{description}</p>
        </div>
        <Link
          href="/products"
          className="text-sm font-semibold text-[color:var(--brand)] hover:underline"
        >
          View all products →
        </Link>
      </div>

      {products.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 px-6 py-10 text-center text-sm text-neutral-600">
          No products here yet. Check back soon.
        </p>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {products.map((product, index) => (
            <ProductCard key={product.id} product={product} priority={index < 4} />
          ))}
        </div>
      )}
    </section>
  );
}

export default async function HomePage() {
  const [categories, featured, latest] = await Promise.all([
    loadPublicCategories(),
    loadFeaturedProducts(),
    loadLatestProducts(),
  ]);
  const rootCategories = categories.filter((category) => category.parentId === null).slice(0, 6);

  return (
    <div className="mx-auto w-full max-w-6xl px-6 pb-20 pt-10 sm:pt-14">
      <HeroCarousel />

      <section aria-label="Shopping benefits" className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {BENEFITS.map((benefit) => (
          <div
            key={benefit.title}
            className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white px-4 py-3 shadow-sm"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[color:var(--brand)]/10 text-[color:var(--brand)]">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true" className="size-5">
                {benefit.icon}
              </svg>
            </span>
            <span>
              <span className="block text-sm font-semibold text-neutral-900">{benefit.title}</span>
              <span className="block text-xs text-neutral-500">{benefit.subtitle}</span>
            </span>
          </div>
        ))}
      </section>

      <section aria-labelledby="categories-heading" className="mt-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--brand)]">
              Browse the store
            </p>
            <h2 id="categories-heading" className="mt-1.5 text-2xl font-semibold tracking-tight">
              Shop by category
            </h2>
            <p className="mt-1.5 text-sm text-neutral-600">
              Find what you need across our departments.
            </p>
          </div>
          <Link href="/products" className="text-sm font-semibold text-[color:var(--brand)] hover:underline">
            See everything →
          </Link>
        </div>

        {rootCategories.length === 0 ? (
          <p className="mt-6 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 px-6 py-10 text-center text-sm text-neutral-600">
            Categories will appear here once they are published.
          </p>
        ) : (
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {rootCategories.map((category) => (
              <Link
                key={category.id}
                href={`/products?category=${encodeURIComponent(category.id)}`}
                className="group overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-[color:var(--brand)] hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--brand)]"
              >
                <div className="relative aspect-square bg-[color:var(--brand-soft)]">
                  <ProductImage
                    src={CATEGORY_IMAGES[category.slug] ?? null}
                    alt={category.name}
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw"
                  />
                </div>
                <div className="px-3 py-3">
                  <span className="block truncate text-sm font-semibold text-neutral-900 group-hover:text-[color:var(--brand)]">
                    {category.name}
                  </span>
                  <span className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-[color:var(--brand)]">
                    Explore
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="size-3">
                      <path d="m9 18 6-6-6-6" />
                    </svg>
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <ProductSection
        id="featured-heading"
        title="Featured products"
        description="Hand-picked favourites from our catalogue."
        products={featured}
      />

      <section className="mt-16 grid overflow-hidden rounded-3xl border border-neutral-200 bg-[color:var(--brand-soft)] lg:grid-cols-2">
        <div className="relative min-h-64 lg:min-h-80">
          <ProductImage
            src="/products/canvas-backpack.jpg"
            alt="Everyday Canvas Backpack"
            sizes="(max-width: 1024px) 100vw, 50vw"
          />
        </div>
        <div className="flex flex-col justify-center px-6 py-10 sm:px-10">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--brand)]">
            Everyday carry
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            Ready for wherever your day goes.
          </h2>
          <p className="mt-3 max-w-md text-sm leading-6 text-neutral-600">
            Discover practical pieces that look good and work hard — from roomy
            backpacks to the little accessories that keep your day organised.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/products" className={primaryButtonClass}>
              Shop the collection
            </Link>
            <Link href="/signup" className={secondaryButtonClass}>
              Create an account
            </Link>
          </div>
        </div>
      </section>

      <section aria-labelledby="promise-heading" className="mt-16 rounded-3xl bg-neutral-900 px-6 py-12 text-white sm:px-10">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-400">
            The EveryNest promise
          </p>
          <h2 id="promise-heading" className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            Good shopping should be simple.
          </h2>
          <p className="mt-3 text-sm leading-6 text-neutral-300">
            We keep the catalogue focused, the prices clear and the experience
            easy — so you can spend less time searching and more time enjoying
            the things you picked.
          </p>
        </div>
        <div className="mt-10 grid gap-6 sm:grid-cols-3">
          {PROMISES.map((promise) => (
            <div key={promise.title} className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <span className="grid size-10 place-items-center rounded-xl bg-amber-400/15 text-amber-400">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true" className="size-5">
                  {promise.icon}
                </svg>
              </span>
              <h3 className="mt-4 text-base font-semibold">{promise.title}</h3>
              <p className="mt-2 text-sm leading-6 text-neutral-300">{promise.body}</p>
            </div>
          ))}
        </div>
      </section>

      <ProductSection
        id="latest-heading"
        title="Latest arrivals"
        description="The newest products added to the store."
        products={latest}
      />

      <section className="mt-16 overflow-hidden rounded-3xl bg-[color:var(--brand)] px-6 py-12 text-center text-white sm:px-10">
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Your next favourite is one click away.
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-white/85">
          Browse the full EveryNest catalogue and find something for every day.
        </p>
        <Link
          href="/products"
          className="mt-6 inline-flex items-center justify-center rounded-xl bg-white px-6 py-3 text-sm font-semibold text-neutral-900 transition hover:bg-white/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          Browse all products
        </Link>
      </section>
    </div>
  );
}
