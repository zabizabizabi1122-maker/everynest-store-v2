import type { Metadata } from "next";
import Link from "next/link";

import { CheckoutForm } from "./checkout-form";

export const metadata: Metadata = {
  title: "Order now · EveryNest",
  description: "Place a cash-on-delivery order at EveryNest without creating an account.",
};

export default function CheckoutPage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-6 pb-20 pt-10">
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-xs text-[color:var(--muted)]">
        <Link href="/" className="hover:text-[color:var(--primary)]">Home</Link>
        <span aria-hidden="true">/</span>
        <Link href="/cart" className="hover:text-[color:var(--primary)]">Cart</Link>
        <span aria-hidden="true">/</span>
        <span className="font-medium text-[color:var(--foreground)]">Order now</span>
      </nav>

      <header className="mt-6">
        <h1 className="text-3xl font-semibold tracking-tight">Order now</h1>
        <p className="mt-1.5 text-sm text-[color:var(--muted)]">
          No account needed. Add your delivery details and our admin team will call or email you to verify the order.
        </p>
      </header>

      <div className="mt-8">
        <CheckoutForm />
      </div>
    </div>
  );
}
