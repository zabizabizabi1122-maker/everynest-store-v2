"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";

import type { CatalogCategory } from "@/lib/catalog";

/** The three departments shown in the centred header menu. */
const DEPARTMENTS = [
  { slug: "clothes", label: "Clothes" },
  { slug: "shoes", label: "Shoes" },
  { slug: "stationery", label: "Stationery" },
] as const;

/**
 * Centred department menu on desktop, hamburger menu on small screens.
 * Native links keep category navigation working without client JavaScript;
 * client state only drives the mobile panel, active indicator and animation.
 */
export function CategoryMenu({ categories }: { categories: readonly CatalogCategory[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeCategory = searchParams.get("category");

  const links = DEPARTMENTS.map(({ slug, label }) => {
    const category = categories.find((item) => item.slug === slug && item.parentId === null);
    return {
      id: category?.id ?? null,
      label,
      href: category
        ? `/products?category=${encodeURIComponent(category.id)}`
        : "/products",
    };
  });

  const departmentActive = (href: string, id: string | null) =>
    pathname === "/products" &&
    id !== null &&
    href === `/products?category=${encodeURIComponent(activeCategory ?? "")}` &&
    activeCategory === id;

  const allProductsActive = pathname === "/products" && activeCategory === null;
  const homeActive = pathname === "/";

  return (
    <>
      <nav
        aria-label="Shop by category"
        className="hidden items-center gap-1 rounded-full border border-[color:var(--border)] bg-[color:var(--background)]/80 p-1 md:flex"
      >
        {links.map((link) => {
          const active = departmentActive(link.href, link.id);
          return (
            <Link
              key={link.label}
              href={link.href}
              data-active={active}
              className={`nav-pill inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-medium transition active:scale-[0.98] motion-reduce:active:scale-100 ${
                active
                  ? "text-[color:var(--primary)]"
                  : "text-foreground hover:text-[color:var(--primary)]"
              }`}
            >
              <span className="nav-pill-dot" aria-hidden="true" />
              {link.label}
            </Link>
          );
        })}
        <Link
          href="/products"
          data-active={allProductsActive}
          className="nav-cta ml-1 hidden items-center gap-1.5 rounded-full bg-[color:var(--primary)] px-3.5 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[color:var(--primary-hover)] hover:shadow-md active:scale-[0.98] motion-reduce:active:scale-100 xl:inline-flex"
        >
          Shop all
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="size-3.5">
            <path d="M5 12h13M12 6l6 6-6 6" />
          </svg>
        </Link>
      </nav>

      <div className="relative md:hidden">
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          aria-expanded={open}
          aria-controls="mobile-category-menu"
          aria-label={open ? "Close menu" : "Open menu"}
          className="inline-flex h-10 items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-sm font-medium text-foreground shadow-sm transition hover:border-[color:var(--primary)]/40 hover:bg-[color:var(--surface-warm)] hover:text-[color:var(--primary)] active:scale-95 motion-reduce:active:scale-100"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true" className="size-5">
            {open ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
          <span>{open ? "Close" : "Menu"}</span>
        </button>

        <div
          id="mobile-category-menu"
          data-open={open}
          aria-hidden={!open}
          inert={!open}
          className="mobile-menu-panel absolute right-0 top-full z-40 mt-3 w-64 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-2 shadow-xl"
        >
          <p className="px-3 pb-1.5 pt-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--muted)]">
            Shop by category
          </p>
          <Link
            href="/"
            onClick={() => setOpen(false)}
            data-active={homeActive}
            className="nav-link block rounded-[10px] px-3 py-2 text-sm font-medium text-foreground transition hover:bg-[color:var(--surface-warm)] hover:text-[color:var(--primary)]"
          >
            Home
          </Link>
          <div className="my-1 border-t border-[color:var(--border)]" />
          {links.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              onClick={() => setOpen(false)}
              data-active={departmentActive(link.href, link.id)}
              className="nav-link block rounded-[10px] px-3 py-2 text-sm font-medium text-foreground transition hover:bg-[color:var(--surface-warm)] hover:text-[color:var(--primary)]"
            >
              {link.label}
            </Link>
          ))}
          <div className="mt-2 border-t border-[color:var(--border)] pt-2">
            <Link
              href="/products"
              onClick={() => setOpen(false)}
              data-active={allProductsActive}
              className="nav-cta flex items-center justify-center gap-2 rounded-[10px] bg-[color:var(--primary)] px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[color:var(--primary-hover)] hover:shadow-md active:scale-[0.98] motion-reduce:active:scale-100"
            >
              Shop all products
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="size-4">
                <path d="M5 12h13M12 6l6 6-6 6" />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
