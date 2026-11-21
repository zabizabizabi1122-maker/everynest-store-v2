import Link from "next/link";

import type { CatalogCategory } from "@/lib/catalog";

/**
 * Native `<details>` dropdown so category navigation needs no client script.
 * Only active categories reach this component (RLS + an explicit filter).
 */
export function CategoryMenu({ categories }: { categories: readonly CatalogCategory[] }) {
  const roots = categories.filter((category) => category.parentId === null);

  // The shell already renders a Products link, so there is nothing to add when
  // no active categories exist yet.
  if (roots.length === 0) return null;

  return (
    <details className="group relative">
      <summary className="flex cursor-pointer list-none items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-medium text-neutral-700 transition hover:text-[color:var(--brand)] [&::-webkit-details-marker]:hidden">
        Categories
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="size-3.5 transition group-open:rotate-180">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </summary>

      <div className="absolute left-0 top-full z-40 mt-1 max-h-96 w-60 overflow-y-auto rounded-xl border border-neutral-200 bg-white p-1.5 shadow-xl">
        <Link
          href="/products"
          className="block rounded-lg px-3 py-2 text-sm font-semibold text-[color:var(--brand)] transition hover:bg-neutral-50"
        >
          All products
        </Link>
        {roots.map((root) => {
          const children = categories.filter((category) => category.parentId === root.id);

          return (
            <div key={root.id} className="border-t border-neutral-100 pt-1 first:border-0">
              <Link
                href={`/products?category=${encodeURIComponent(root.id)}`}
                className="block rounded-lg px-3 py-2 text-sm font-medium text-neutral-800 transition hover:bg-neutral-50"
              >
                {root.name}
              </Link>
              {children.map((child) => (
                <Link
                  key={child.id}
                  href={`/products?category=${encodeURIComponent(child.id)}`}
                  className="block rounded-lg py-1.5 pl-6 pr-3 text-xs text-neutral-600 transition hover:bg-neutral-50 hover:text-neutral-900"
                >
                  {child.name}
                </Link>
              ))}
            </div>
          );
        })}
      </div>
    </details>
  );
}
