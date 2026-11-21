"use client";

import { useMemo, useState } from "react";

import type { CategoryAttribute } from "@/lib/category-schema";
import { trustedCartImageUrl, MAX_CART_QUANTITY } from "@/lib/cart";
import { formatPkr } from "@/lib/money";
import {
  availableOptionsFor,
  buildSelectorAttributes,
  describeAttributes,
  describeAvailability,
  displayPricePaisa,
  matchVariant,
  type SelectorVariant,
} from "@/lib/storefront";

import { useCart } from "./cart-provider";

interface AddToCartProps {
  productName: string;
  imageUrl: string | null;
  variants: SelectorVariant[];
  schema: CategoryAttribute[];
}

/**
 * Product-detail purchase control.
 *
 * A variant is only accepted when every selector attribute is chosen and the
 * combination matches exactly one active variant with stock available. The
 * cart receives a display snapshot only — checkout revalidates everything.
 */
export function AddToCart({ productName, imageUrl, variants, schema }: AddToCartProps) {
  const { addItem, openCart } = useCart();
  const [selection, setSelection] = useState<Record<string, string>>({});
  const [quantity, setQuantity] = useState(1);

  const attributes = useMemo(
    () => buildSelectorAttributes(schema, variants),
    [schema, variants],
  );

  const selectedCount = Object.values(selection).filter((value) => value !== "").length;

  const matchedVariant = useMemo(() => {
    if (variants.length === 0) return null;
    // Products with no meaningful attributes have at most one active variant.
    if (attributes.length === 0) return variants.length === 1 ? variants[0] : null;
    if (selectedCount !== attributes.length) return null;
    return matchVariant(variants, selection);
  }, [attributes, selectedCount, selection, variants]);

  const availability = describeAvailability(matchedVariant?.stock ?? 0);
  const maxQuantity = Math.min(matchedVariant?.stock ?? 0, MAX_CART_QUANTITY);
  const canAdd = matchedVariant !== null && availability.orderable;

  function choose(key: string, value: string) {
    setSelection((current) => {
      const next: Record<string, string> = { ...current, [key]: value };

      // Clear any other choice that has become impossible with this selection.
      for (const attribute of attributes) {
        if (attribute.key === key) continue;
        const chosen = next[attribute.key];
        if (!chosen) continue;
        if (!availableOptionsFor(attributes, variants, next, attribute.key).includes(chosen)) {
          delete next[attribute.key];
        }
      }

      return next;
    });
  }

  function handleAdd() {
    if (!canAdd || !matchedVariant) return;

    addItem({
      variantId: matchedVariant.id,
      quantity: Math.min(Math.max(1, quantity), maxQuantity),
      display: {
        name: productName,
        attributesLabel: describeAttributes(matchedVariant.attributes, schema),
        imageUrl: trustedCartImageUrl(imageUrl),
        displayUnitPricePaisa: displayPricePaisa(matchedVariant),
      },
    });
    openCart();
    setQuantity(1);
  }

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      {attributes.length > 0 ? (
        <div className="space-y-5">
          {attributes.map((attribute) => {
            const enabledOptions = availableOptionsFor(attributes, variants, selection, attribute.key);

            return (
              <fieldset key={attribute.key}>
                <legend className="text-sm font-semibold text-neutral-800">{attribute.label}</legend>
                <div className="mt-2.5 flex flex-wrap gap-2" role="radiogroup" aria-label={attribute.label}>
                  {attribute.options.map((option) => {
                    const chosen = selection[attribute.key] === option;
                    const enabled = enabledOptions.includes(option);

                    return (
                      <button
                        key={option}
                        type="button"
                        role="radio"
                        aria-checked={chosen}
                        disabled={!enabled}
                        onClick={() => choose(attribute.key, option)}
                        className={`min-w-12 rounded-xl border px-3.5 py-2 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--brand)] disabled:cursor-not-allowed disabled:opacity-40 ${
                          chosen
                            ? "border-[color:var(--brand)] bg-[color:var(--brand)] text-white"
                            : "border-neutral-300 bg-white text-neutral-700 hover:border-neutral-400 hover:bg-neutral-50"
                        }`}
                      >
                        {option}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            );
          })}
        </div>
      ) : null}

      <div className="mt-6 border-t border-neutral-200 pt-5">
        {matchedVariant ? (
          <>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-2xl font-bold text-[color:var(--brand)]">
                {formatPkr(displayPricePaisa(matchedVariant))}
              </span>
              {matchedVariant.salePricePaisa !== null ? (
                <span className="text-sm text-neutral-400 line-through">
                  {formatPkr(matchedVariant.pricePaisa)}
                </span>
              ) : null}
            </div>
            <p className={`mt-1.5 text-sm font-medium ${availability.tone === "out" ? "text-red-700" : availability.tone === "low" ? "text-amber-700" : "text-emerald-700"}`}>
              {availability.label}
            </p>
            <p className="mt-1 text-xs text-neutral-500">SKU: {matchedVariant.sku}</p>
          </>
        ) : (
          <p className="text-sm text-neutral-500">
            {variants.length === 0
              ? "No active variants are available for this product."
              : "Choose an option above to see the price and availability."}
          </p>
        )}
      </div>

      <div className="mt-5 flex items-center gap-3">
        <div className="inline-flex items-center rounded-xl border border-neutral-300">
          <button
            type="button"
            onClick={() => setQuantity((current) => Math.max(1, current - 1))}
            disabled={quantity <= 1}
            aria-label="Decrease quantity"
            className="px-3 py-2.5 text-neutral-600 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            −
          </button>
          <span aria-live="polite" className="min-w-8 text-center text-sm font-semibold">
            {quantity}
          </span>
          <button
            type="button"
            onClick={() => setQuantity((current) => Math.min(maxQuantity || MAX_CART_QUANTITY, current + 1))}
            disabled={maxQuantity > 0 && quantity >= maxQuantity}
            aria-label="Increase quantity"
            className="px-3 py-2.5 text-neutral-600 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            +
          </button>
        </div>

        <button
          type="button"
          onClick={handleAdd}
          disabled={!canAdd}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[color:var(--brand)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[color:var(--brand)]/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--brand)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" className="size-5">
            <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
            <path d="M3 6h18M16 10a4 4 0 0 1-8 0" />
          </svg>
          {matchedVariant && !availability.orderable ? "Out of stock" : "Add to cart"}
        </button>
      </div>
    </div>
  );
}
