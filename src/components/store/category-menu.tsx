"use client";

import Link from "next/link";
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
 * the client state here only opens and closes the mobile panel.
 */
export function CategoryMenu({ categories }: { categories: readonly CatalogCategory[] }) {
  const [open, setOpen] = useState(false);

  const links = DEPARTMENTS.map(({ slug, label }) => {
    const category = categories.find((item) => item.slug === slug && item.parentId === null);
    return {
      label,
      href: category
        ? `/products?category=${encodeURIComponent(category.id)}`
        : "/products",
    };
  });

  return (
    <>
      <nav
        aria-label="Shop by category"
        className="hidden items-center gap-1 md:flex"
      >
        {links.map((link) => (
          <Link
            key={link.label}
            href={link.href}
            className="rounded-[10px] px-3 py-2 text-sm font-medium text-foreground transition hover:bg-[color:var(--background)] hover:text-[color:var(--primary)]"
          >
            {link.label}
          </Link>
        ))}
      </nav>

      <div className="relative md:hidden">
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          aria-expanded={open}
          aria-controls="mobile-category-menu"
          aria-label={open ? "Close menu" : "Open menu"}
          className="grid size-10 place-items-center rounded-[10px] border border-[color:var(--border)] bg-[color:var(--surface)] text-foreground transition hover:bg-[color:var(--background)]"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true" className="size-5">
            {open ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>

        {open ? (
          <div
            id="mobile-category-menu"
            className="animate-slide-in absolute right-0 top-full z-40 mt-3 w-60 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-2 shadow-lg"
          >
            <Link
              href="/"
              onClick={() => setOpen(false)}
              className="block rounded-[10px] px-3 py-2 text-sm font-medium text-foreground transition hover:bg-[color:var(--background)]"
            >
              Home
            </Link>
            <Link
              href="/products"
              onClick={() => setOpen(false)}
              className="block rounded-[10px] px-3 py-2 text-sm font-medium text-foreground transition hover:bg-[color:var(--background)]"
            >
              All products
            </Link>
            <div className="my-1 border-t border-[color:var(--border)]" />
            {links.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                onClick={() => setOpen(false)}
                className="block rounded-[10px] px-3 py-2 text-sm font-medium text-foreground transition hover:bg-[color:var(--background)] hover:text-[color:var(--primary)]"
              >
                {link.label}
              </Link>
            ))}
          </div>
        ) : null}
      </div>
    </>
  );
}
