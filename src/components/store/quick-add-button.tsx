"use client";

import { useCart } from "./cart-provider";
import { trustedCartImageUrl } from "@/lib/cart";

interface QuickAddButtonProps {
  variantId: string;
  productName: string;
  imageUrl: string | null;
  pricePaisa: number;
}

/**
 * One-tap add for products with a single active variant. Multi-variant products
 * must use the detail page so the customer can choose the right combination.
 * The cart only stores a display snapshot; checkout revalidates against the DB.
 */
export function QuickAddButton({ variantId, productName, imageUrl, pricePaisa }: QuickAddButtonProps) {
  const { addItem, openCart } = useCart();

  function handleAdd() {
    addItem({
      variantId,
      quantity: 1,
      display: {
        name: productName,
        attributesLabel: "",
        imageUrl: trustedCartImageUrl(imageUrl),
        displayUnitPricePaisa: pricePaisa,
      },
    });
    openCart();
  }

  return (
    <button
      type="button"
      onClick={handleAdd}
      aria-label={`Add ${productName} to cart`}
      className="mt-3 inline-flex items-center justify-center gap-2 rounded-[10px] bg-[color:var(--primary)] px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-[color:var(--primary-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--primary)]"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" className="size-4">
        <path d="M3 3h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.6L21 7H6" />
        <circle cx="10" cy="20" r="1.4" />
        <circle cx="18" cy="20" r="1.4" />
      </svg>
      Add to cart
    </button>
  );
}
