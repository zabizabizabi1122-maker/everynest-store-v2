import type { Metadata } from "next";
import Link from "next/link";

import { CartContent } from "@/components/store/cart-content";

export const metadata: Metadata = {
  title: "Your cart · EveryNest",
  description: "Review the items in your EveryNest cart.",
};

export default function CartPage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-6 pb-20 pt-10">
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
        <Link href="/" className="hover:text-[color:var(--brand)]">Home</Link>
        <span aria-hidden="true">/</span>
        <span className="font-medium text-neutral-800">Cart</span>
      </nav>

      <header className="mt-6">
        <h1 className="text-3xl font-semibold tracking-tight">Your cart</h1>
        <p className="mt-1.5 text-sm text-neutral-600">
          Check your items, then continue to secure cash-on-delivery checkout.
        </p>
      </header>

      <div className="mt-8">
        <CartContent />
      </div>
    </div>
  );
}
