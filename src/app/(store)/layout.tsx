import Link from "next/link";
import type { ReactNode } from "react";

import { signOutAction } from "@/app/(auth)/actions";
import { BrandMark } from "@/components/store/brand-mark";
import { CartButton } from "@/components/store/cart-button";
import { CartDrawer } from "@/components/store/cart-drawer";
import { CartProvider } from "@/components/store/cart-provider";
import { CategoryMenu } from "@/components/store/category-menu";
import { PromoBar } from "@/components/store/promo-bar";
import { ScrollToTop } from "@/components/store/scroll-to-top";
import { SearchForm } from "@/components/store/search-form";
import { ToastProvider } from "@/components/store/toast";
import { primaryButtonClass, secondaryButtonClass } from "@/components/ui/form";
import { getCurrentUser } from "@/lib/auth";
import { loadPublicCategories } from "@/lib/catalog";
import { isSupabaseConfigured } from "@/lib/env";

/**
 * The header reflects the verified session, so this layout reads cookies and
 * cannot be prerendered as a static shell. `instant = false` is the Next 16
 * Cache Components way of declaring a deliberately blocking route.
 */
export const instant = false;

/**
 * Customer storefront shell: session-aware header, category navigation,
 * search and the non-authoritative client cart.
 */
export default async function StoreLayout({ children }: { children: ReactNode }) {
  const configured = isSupabaseConfigured();
  const [user, categories] = await Promise.all([
    configured ? getCurrentUser() : Promise.resolve(null),
    loadPublicCategories(),
  ]);

  return (
    <ToastProvider>
      <CartProvider>
        <PromoBar />
        <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white/95 backdrop-blur">
          <div className="mx-auto w-full max-w-6xl px-6 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Link href="/" className="text-[color:var(--brand)]" aria-label="EveryNest home">
                <BrandMark variant="dark" size="md" />
              </Link>

              <div className="order-3 w-full sm:order-none sm:w-auto sm:flex-1 sm:px-8">
                <SearchForm />
              </div>

              <nav aria-label="Account" className="flex items-center gap-2">
                <CartButton />
                {user ? (
                  <>
                    <Link href="/account" className={secondaryButtonClass}>
                      My account
                    </Link>
                    <form action={signOutAction}>
                      <button type="submit" className={secondaryButtonClass}>
                        Sign out
                      </button>
                    </form>
                  </>
                ) : (
                  <>
                    <Link href="/login" className={secondaryButtonClass}>
                      Log in
                    </Link>
                    <Link href="/signup" className={primaryButtonClass}>
                      Create account
                    </Link>
                  </>
                )}
              </nav>
            </div>

            <nav aria-label="Main navigation" className="mt-3 flex items-center gap-1 border-t border-neutral-100 pt-2">
              <Link
                href="/"
                className="rounded-lg px-2 py-1.5 text-sm font-medium text-neutral-700 transition hover:text-[color:var(--brand)]"
              >
                Home
              </Link>
              <Link
                href="/products"
                className="rounded-lg px-2 py-1.5 text-sm font-medium text-neutral-700 transition hover:text-[color:var(--brand)]"
              >
                Products
              </Link>
              <Link
                href="/cart"
                className="rounded-lg px-2 py-1.5 text-sm font-medium text-neutral-700 transition hover:text-[color:var(--brand)]"
              >
                Cart
              </Link>
              <CategoryMenu categories={categories} />
            </nav>
          </div>
        </header>

        <CartDrawer />
        <div className="flex flex-1 flex-col">{children}</div>

        <footer className="border-t border-neutral-200 bg-neutral-50">
          <div className="mx-auto w-full max-w-6xl px-6 py-8">
            <div className="flex flex-wrap items-center justify-between gap-6">
              <BrandMark variant="dark" size="sm" />
              <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-neutral-600">
                <Link href="/" className="hover:text-[color:var(--brand)]">Home</Link>
                <Link href="/products" className="hover:text-[color:var(--brand)]">All products</Link>
                <Link href="/account" className="hover:text-[color:var(--brand)]">My account</Link>
              </nav>
            </div>
            <p className="mt-5 text-xs text-neutral-500">
              EveryNest — clothes, stationery and shoes, delivered across Pakistan.
            </p>
          </div>
        </footer>

        <ScrollToTop />
      </CartProvider>
    </ToastProvider>
  );
}
