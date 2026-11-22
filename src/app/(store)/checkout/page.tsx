import type { Metadata } from "next";
import Link from "next/link";

import { toAddressPrefill } from "@/lib/addresses";
import { loadDefaultAddress } from "@/lib/address-data";
import { getCurrentProfile, requireUser } from "@/lib/auth";

import { CheckoutForm } from "./checkout-form";

export const metadata: Metadata = {
  title: "Checkout · EveryNest",
  description: "Place a cash-on-delivery order at EveryNest.",
};

export default async function CheckoutPage() {
  const user = await requireUser("/checkout");
  const [profile, defaultAddress] = await Promise.all([
    getCurrentProfile(),
    loadDefaultAddress(),
  ]);
  // A saved default address wins over the profile details for checkout prefill.
  const prefill = defaultAddress ? toAddressPrefill(defaultAddress) : null;

  return (
    <div className="mx-auto w-full max-w-5xl px-6 pb-20 pt-10">
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-xs text-[color:var(--muted)]">
        <Link href="/" className="hover:text-[color:var(--primary)]">Home</Link>
        <span aria-hidden="true">/</span>
        <Link href="/cart" className="hover:text-[color:var(--primary)]">Cart</Link>
        <span aria-hidden="true">/</span>
        <span className="font-medium text-[color:var(--foreground)]">Checkout</span>
      </nav>

      <header className="mt-6">
        <h1 className="text-3xl font-semibold tracking-tight">Checkout</h1>
        <p className="mt-1.5 text-sm text-[color:var(--muted)]">
          Signed in as <span className="font-medium text-[color:var(--foreground)]">{user.email}</span>. Review your
          delivery details and confirm your cash-on-delivery order.
        </p>
      </header>

      <div className="mt-8">
        <CheckoutForm
          defaultFullName={prefill?.fullName ?? profile?.full_name ?? ""}
          defaultPhone={prefill?.phone ?? profile?.phone ?? ""}
          defaultCity={prefill?.city ?? ""}
          defaultAddress={prefill?.address ?? ""}
        />
      </div>
    </div>
  );
}
