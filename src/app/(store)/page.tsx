import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import { defaultHeroSlides, HeroCarousel, type HeroSlide } from "@/components/store/hero-carousel";
import { ProductCard } from "@/components/store/product-card";
import { ProductImage } from "@/components/store/product-image";
import { loadFeaturedProducts, loadLatestProducts, loadPublicCategories } from "@/lib/catalog";
import type { CatalogCategory } from "@/lib/catalog";
import { loadActiveHeroSlides } from "@/lib/site-settings";
import { Reveal } from "@/components/ui/reveal";

/**
 * Live catalogue data is read during render, so this page is deliberately
 * blocking rather than pretending to be an instant prerendered shell.
 */
export const instant = false;

export const metadata: Metadata = {
  title: "EveryNest — clothes, stationery and shoes",
  description:
    "Discover everyday clothes, stationery, shoes and more at EveryNest. Clear prices, real stock and nationwide delivery across Pakistan.",
};

/** Local product photos used to give each category tile a visual cue. */
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
    icon: <path d="M20 6 9 17l-5-5" />,
  },
] as const;

function SectionHeading({
  eyebrow,
  id,
  title,
  description,
  more = true,
}: {
  eyebrow: string;
  id?: string;
  title: string;
  description: string;
  more?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--primary)]">
          {eyebrow}
        </p>
        <h2 id={id} className="mt-2 font-heading text-[28px] font-semibold tracking-tight text-foreground lg:text-[32px]">
          {title}
        </h2>
        <p className="mt-2 max-w-[68ch] text-base leading-relaxed text-[color:var(--muted)]">
          {description}
        </p>
      </div>
      {more ? (
        <Link
          href="/products"
          className="text-sm font-semibold text-[color:var(--primary)] transition hover:underline"
        >
          View all products →
        </Link>
      ) : null}
    </div>
  );
}

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
    <section aria-labelledby={id} className="py-10 lg:py-16">
      <Reveal>
        <SectionHeading
          eyebrow="From the catalogue"
          id={id}
          title={title}
          description={description}
        />
      </Reveal>

      {products.length === 0 ? (
        <Reveal className="mt-6">
          <p className="rounded-xl border border-dashed border-[color:var(--border)] bg-[color:var(--surface)] px-6 py-10 text-center text-sm text-[color:var(--muted)]">
            No products here yet. Check back soon.
          </p>
        </Reveal>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 lg:gap-5">
          {products.map((product, index) => (
            <Reveal key={product.id} className="h-full" delay={index * 50}>
              <ProductCard product={product} priority={index < 4} />
            </Reveal>
          ))}
        </div>
      )}
    </section>
  );
}

export default async function HomePage() {
  await connection();

  const [categories, featured, latest, storedSlides] = await Promise.all([
    loadPublicCategories(),
    loadFeaturedProducts(),
    loadLatestProducts(),
    loadActiveHeroSlides(),
  ]);

  // Three real departments, with the usual storefront order first.
  const preferred = ["clothes", "shoes", "stationery"]
    .map((slug) => categories.find((category) => category.slug === slug && category.parentId === null))
    .filter((category): category is CatalogCategory => Boolean(category));
  const roots = categories.filter((category) => category.parentId === null);
  const categoryCards = [...preferred, ...roots.filter((item) => !preferred.some((pick) => pick.id === item.id))].slice(0, 3);

  // The catalogue filters by category id, so resolve the "clothes" slide link
  // from live data instead of passing a slug that would be silently ignored.
  const clothingHref = preferred[0]
    ? `/products?category=${encodeURIComponent(preferred[0].id)}`
    : "/products";
  // Stored slides win; the original hardcoded slides remain the graceful
  // fallback while no active slides exist. The real clothing category link is
  // reapplied to any slide with the "Explore clothing" call to action.
  const sourceSlides = storedSlides.length > 0 ? storedSlides : defaultHeroSlides;
  const heroSlides: HeroSlide[] = sourceSlides.map((slide) =>
    slide.primary.label.trim().toLowerCase() === "explore clothing"
      ? { ...slide, primary: { ...slide.primary, href: clothingHref } }
      : slide,
  );

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 pb-20 sm:px-6">
      <div className="pt-6 lg:pt-10">
        <HeroCarousel slides={heroSlides} />
      </div>

      <section aria-labelledby="categories-heading" className="py-10 lg:py-16">
        <Reveal>
          <SectionHeading
            eyebrow="Browse the store"
            id="categories-heading"
            title="Shop by category"
            description="Find what you need across our departments."
          />
        </Reveal>

        {categoryCards.length === 0 ? (
          <Reveal className="mt-6">
            <p className="rounded-xl border border-dashed border-[color:var(--border)] bg-[color:var(--surface)] px-6 py-10 text-center text-sm text-[color:var(--muted)]">
              Categories will appear here once they are published.
            </p>
          </Reveal>
        ) : (
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {categoryCards.map((category, index) => (
              <Reveal key={category.id} className="h-full" delay={index * 70}>
                <Link
                  href={`/products?category=${encodeURIComponent(category.id)}`}
                  className="group flex h-full flex-col overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] transition hover:-translate-y-0.5 hover:shadow-md active:scale-[0.99] motion-reduce:active:scale-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--primary)]"
                >
                  <div className="relative aspect-[4/3] overflow-hidden bg-[color:var(--background)]">
                    <ProductImage
                      src={CATEGORY_IMAGES[category.slug] ?? null}
                      alt={category.name}
                      sizes="(max-width: 640px) 100vw, 33vw"
                    />
                  </div>
                  <div className="flex flex-1 items-center justify-between gap-3 px-4 py-4">
                    <div className="min-w-0">
                      <h3 className="truncate font-heading text-lg font-medium text-foreground transition group-hover:text-[color:var(--primary)]">
                        {category.name}
                      </h3>
                      <p className="mt-0.5 text-sm text-[color:var(--muted)]">Explore the collection</p>
                    </div>
                    <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full border border-[color:var(--border)] text-[color:var(--primary)] transition group-hover:bg-[color:var(--primary)] group-hover:text-white">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4">
                        <path d="m9 18 6-6-6-6" />
                      </svg>
                    </span>
                  </div>
                </Link>
              </Reveal>
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

      <section aria-label="Shopping benefits" className="border-y border-[color:var(--border)] bg-[color:var(--surface)] py-10 lg:py-12">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {BENEFITS.map((benefit, index) => (
            <Reveal key={benefit.title} delay={index * 60}>
              <div className="flex items-center gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[color:var(--background)] text-[color:var(--primary)]">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true" className="size-5">
                    {benefit.icon}
                  </svg>
                </span>
                <span>
                  <span className="block font-heading text-sm font-semibold text-foreground">{benefit.title}</span>
                  <span className="block text-sm text-[color:var(--muted)]">{benefit.subtitle}</span>
                </span>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <ProductSection
        id="latest-heading"
        title="New arrivals"
        description="The newest products added to the store."
        products={latest}
      />
    </div>
  );
}
