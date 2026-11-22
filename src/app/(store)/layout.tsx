import Link from "next/link";
import { connection } from "next/server";
import type { ReactNode } from "react";

import { BrandMark } from "@/components/store/brand-mark";
import { CartButton } from "@/components/store/cart-button";
import { CartDrawer } from "@/components/store/cart-drawer";
import { CartProvider } from "@/components/store/cart-provider";
import { CategoryMenu } from "@/components/store/category-menu";
import { PromoBar } from "@/components/store/promo-bar";
import { ScrollToTop } from "@/components/store/scroll-to-top";
import { SearchForm } from "@/components/store/search-form";
import { ToastProvider } from "@/components/store/toast";
import { loadPublicCategories } from "@/lib/catalog";

/**
 * Category navigation is loaded per request, so this layout cannot be
 * prerendered as a static shell. `instant = false` is the Next 16 Cache
 * Components way of declaring a deliberately blocking route.
 */
export const instant = false;

const footerLinkClass = "block py-1.5 text-sm text-white/70 transition hover:text-white";

/**
 * Customer storefront shell: category navigation, search and the
 * non-authoritative client cart. Authentication lives in the admin panel.
 */
export default async function StoreLayout({ children }: { children: ReactNode }) {
  // Catalogue reads are request-bound; keep this shell out of the prerender.
  await connection();

  const categories = await loadPublicCategories();

  const departmentHref = (slug: string) => {
    const category = categories.find((item) => item.slug === slug && item.parentId === null);
    return category ? `/products?category=${encodeURIComponent(category.id)}` : "/products";
  };

  return (
    <ToastProvider>
      <CartProvider>
        <PromoBar />
        <header className="sticky top-0 z-30 border-b border-[color:var(--border)] bg-[color:var(--surface)]/95 backdrop-blur">
          <div className="mx-auto w-full max-w-[1200px] px-4 sm:px-6">
            <div className="flex items-center gap-2 py-3">
              <Link href="/" className="shrink-0" aria-label="EveryNest home">
                <BrandMark variant="dark" size="md" />
              </Link>

              <div className="order-last md:order-none md:flex md:flex-1 md:justify-center">
                <CategoryMenu categories={categories} />
              </div>

              <div className="hidden w-52 sm:block lg:w-64">
                <SearchForm />
              </div>

              <div className="ml-auto flex items-center gap-1.5 sm:ml-0">
                <CartButton />
              </div>
            </div>

            <div className="pb-3 sm:hidden">
              <SearchForm />
            </div>
          </div>
        </header>

        <CartDrawer />
        <div className="flex flex-1 flex-col">{children}</div>

        <footer className="bg-[color:var(--footer)] text-white">
          <div className="mx-auto w-full max-w-[1200px] px-4 py-12 sm:px-6">
            <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
              <div>
                <BrandMark variant="light" size="md" />
                <p className="mt-4 max-w-[40ch] text-sm leading-relaxed text-white/70">
                  Everyday essentials, picked for you. Clothes, stationery and
                  shoes with clear prices and nationwide delivery.
                </p>
                <div className="mt-5 flex items-center gap-2" aria-label="Follow EveryNest">
                  <span className="grid size-9 place-items-center rounded-full border border-white/20 text-white/70" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="size-4">
                      <rect x="3" y="3" width="18" height="18" rx="5" />
                      <circle cx="12" cy="12" r="4" />
                      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
                    </svg>
                  </span>
                  <span className="grid size-9 place-items-center rounded-full border border-white/20 text-white/70" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="size-4">
                      <path d="M14 8h3V4h-3a5 5 0 0 0-5 5v3H6v4h3v6h4v-6h3l1-4h-4V9a1 1 0 0 1 1-1Z" />
                    </svg>
                  </span>
                  <span className="grid size-9 place-items-center rounded-full border border-white/20 text-white/70" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="size-4">
                      <path d="M4 8c4 0 8 3 8 8 0-5 4-8 8-8M5 17h14" />
                    </svg>
                  </span>
                </div>
              </div>

              <nav aria-label="Shop">
                <h2 className="font-heading text-sm font-semibold uppercase tracking-[0.16em] text-white">Shop</h2>
                <div className="mt-3">
                  <Link href="/products" className={footerLinkClass}>All products</Link>
                  <Link href={departmentHref("clothes")} className={footerLinkClass}>Clothes</Link>
                  <Link href={departmentHref("shoes")} className={footerLinkClass}>Shoes</Link>
                  <Link href={departmentHref("stationery")} className={footerLinkClass}>Stationery</Link>
                </div>
              </nav>

              <nav aria-label="Support">
                <h2 className="font-heading text-sm font-semibold uppercase tracking-[0.16em] text-white">Support</h2>
                <div className="mt-3">
                  <Link href="/cart" className={footerLinkClass}>Cart</Link>
                </div>
              </nav>

              <div>
                <h2 className="font-heading text-sm font-semibold uppercase tracking-[0.16em] text-white">Contact</h2>
                <p className="mt-3 text-sm leading-relaxed text-white/70">
                  EveryNest · Pakistan
                </p>
                <p className="mt-2 text-sm leading-relaxed text-white/70">
                  Nationwide delivery and cash on delivery on every order.
                </p>
                <p className="mt-2 text-sm leading-relaxed text-white/70">
                  Order help is available from our support team.
                </p>
              </div>
            </div>

            <div className="mt-10 border-t border-white/15 pt-6 text-xs text-white/55">
              EveryNest — clothes, stationery and shoes, delivered across Pakistan.
            </div>
          </div>
        </footer>

        <ScrollToTop />
      </CartProvider>
    </ToastProvider>
  );
}
