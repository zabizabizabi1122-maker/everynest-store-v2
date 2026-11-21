import type { Metadata } from "next";
import Link from "next/link";

import { secondaryButtonClass } from "@/components/ui/form";
import { loadSavedAddresses } from "@/lib/address-data";

import { AddressForm } from "./address-form";
import { deleteAddressAction, setDefaultAddressAction } from "./actions";

export const metadata: Metadata = {
  title: "Saved addresses · EveryNest",
  description: "Manage your reusable delivery addresses.",
};

export default async function AddressesPage() {
  const addresses = await loadSavedAddresses();

  return (
    <div className="mx-auto w-full max-w-5xl px-6 pb-20 pt-10">
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
        <Link href="/" className="hover:text-[color:var(--brand)]">Home</Link>
        <span aria-hidden="true">/</span>
        <Link href="/account" className="hover:text-[color:var(--brand)]">My account</Link>
        <span aria-hidden="true">/</span>
        <span className="font-medium text-neutral-800">Saved addresses</span>
      </nav>

      <header className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--brand)]">
            Level 11 · Optional features
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Saved addresses</h1>
          <p className="mt-1.5 text-sm text-neutral-600">
            Reuse a delivery address at checkout instead of typing it every time.
          </p>
        </div>
        <Link href="/account" className={secondaryButtonClass}>
          Back to account
        </Link>
      </header>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_22rem]">
        <section aria-labelledby="address-list" className="space-y-4">
          <h2 id="address-list" className="text-base font-semibold text-neutral-900">
            Your addresses
          </h2>

          {addresses.length === 0 ? (
            <p className="rounded-2xl border border-neutral-200 bg-white p-6 text-sm text-neutral-600">
              You have no saved addresses yet. Add one to speed up checkout.
            </p>
          ) : (
            addresses.map((address) => (
              <article
                key={address.id}
                className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="font-semibold text-neutral-900">{address.label}</h3>
                  {address.isDefault ? (
                    <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                      Default
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 text-sm text-neutral-700">{address.fullName}</p>
                <p className="text-sm text-neutral-600">{address.phone}</p>
                <p className="mt-1 whitespace-pre-line text-sm text-neutral-600">
                  {address.address}, {address.city}
                </p>

                <div className="mt-4 flex flex-wrap gap-4 text-sm">
                  {!address.isDefault ? (
                    <form action={setDefaultAddressAction}>
                      <input type="hidden" name="addressId" value={address.id} />
                      <button type="submit" className="font-medium text-[color:var(--brand)] hover:underline">
                        Make default
                      </button>
                    </form>
                  ) : null}
                  <form action={deleteAddressAction}>
                    <input type="hidden" name="addressId" value={address.id} />
                    <button type="submit" className="font-medium text-rose-700 hover:underline">
                      Delete
                    </button>
                  </form>
                </div>
              </article>
            ))
          )}
        </section>

        <AddressForm />
      </div>
    </div>
  );
}
