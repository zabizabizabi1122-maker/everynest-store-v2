import type { Metadata } from "next";
import Link from "next/link";

import { getCurrentProfile, requireUser } from "@/lib/auth";
import { isStaffRole, roleLabel } from "@/lib/roles";

import { ProfileForm } from "./profile-form";

export const metadata: Metadata = {
  title: "My account · EveryNest",
  description: "Manage your EveryNest profile.",
};

interface AccountPageProps {
  searchParams: Promise<{ notice?: string }>;
}

export default async function AccountPage({ searchParams }: AccountPageProps) {
  const params = await searchParams;
  const user = await requireUser("/account");
  const profile = await getCurrentProfile();
  const staffAccess = isStaffRole(profile?.role);
  const notice =
    params.notice === "staff-only"
      ? "The admin area is restricted to staff and admin accounts. Your account has customer access."
      : null;

  const memberSince = profile
    ? new Intl.DateTimeFormat("en-PK", { dateStyle: "medium" }).format(
        new Date(profile.created_at),
      )
    : null;

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-12">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">My account</h1>
        <p className="mt-1.5 text-sm text-[color:var(--muted)]">
          Signed in as <span className="font-medium text-[color:var(--foreground)]">{user.email}</span>
        </p>
      </header>

      {notice ? (
        <p
          role="status"
          className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
        >
          {notice}
        </p>
      ) : null}

      {staffAccess ? (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[color:var(--brand)]/20 bg-[color:var(--brand-soft)] px-5 py-4">
          <div>
            <p className="text-sm font-semibold text-[color:var(--primary)]">
              You have {roleLabel(profile?.role)} access
            </p>
            <p className="mt-0.5 text-sm text-[color:var(--foreground)]">
              Open the admin panel to manage the store.
            </p>
          </div>
          <Link
            href="/admin"
            className="inline-flex items-center justify-center rounded-xl bg-[color:var(--brand)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[color:var(--brand)]/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--primary)]"
          >
            Open admin panel
          </Link>
        </div>
      ) : null}

      <section
        aria-labelledby="orders-link"
        className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-5 shadow-sm"
      >
        <div>
          <h2 id="orders-link" className="text-sm font-semibold text-[color:var(--foreground)]">
            My orders
          </h2>
          <p className="mt-0.5 text-sm text-[color:var(--muted)]">
            Track deliveries, view invoices and cancel a pending order.
          </p>
        </div>
        <Link
          href="/orders"
          className="inline-flex items-center justify-center rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm font-medium text-[color:var(--foreground)] transition hover:bg-[color:var(--background)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--primary)]"
        >
          View orders
        </Link>
      </section>

      <section
        aria-labelledby="addresses-link"
        className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-5 shadow-sm"
      >
        <div>
          <h2 id="addresses-link" className="text-sm font-semibold text-[color:var(--foreground)]">
            Saved addresses
          </h2>
          <p className="mt-0.5 text-sm text-[color:var(--muted)]">
            Manage delivery addresses and prefill checkout in one tap.
          </p>
        </div>
        <Link
          href="/account/addresses"
          className="inline-flex items-center justify-center rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm font-medium text-[color:var(--foreground)] transition hover:bg-[color:var(--background)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--primary)]"
        >
          Manage addresses
        </Link>
      </section>

      <section
        aria-labelledby="profile-details"
        className="mt-8 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-6 shadow-sm"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="profile-details" className="text-lg font-semibold">
            Profile details
          </h2>
          <span className="rounded-full bg-[color:var(--brand-soft)] px-3 py-1 text-xs font-semibold text-[color:var(--primary)]">
            {roleLabel(profile?.role)}
          </span>
        </div>

        <p className="mt-1.5 text-sm text-[color:var(--muted)]">
          Update your name and mobile number. Your email address and role are managed by
          the store owner.
        </p>

        {profile ? (
          <ProfileForm
            defaultFullName={profile.full_name ?? ""}
            defaultPhone={profile.phone ?? ""}
          />
        ) : (
          <p
            role="alert"
            className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
          >
            We could not load your profile. Refresh the page, and if it keeps happening,
            log out and log in again.
          </p>
        )}
      </section>

      <section
        aria-labelledby="account-info"
        className="mt-6 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-6 shadow-sm"
      >
        <h2 id="account-info" className="text-lg font-semibold">
          Account information
        </h2>
        <dl className="mt-4 divide-y divide-neutral-200 text-sm">
          <div className="flex items-center justify-between gap-4 py-3">
            <dt className="text-[color:var(--muted)]">Email</dt>
            <dd className="font-medium text-[color:var(--foreground)]">{user.email}</dd>
          </div>
          <div className="flex items-center justify-between gap-4 py-3">
            <dt className="text-[color:var(--muted)]">Role</dt>
            <dd className="font-medium text-[color:var(--foreground)]">
              {roleLabel(profile?.role)}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4 py-3">
            <dt className="text-[color:var(--muted)]">Member since</dt>
            <dd className="font-medium text-[color:var(--foreground)]">{memberSince ?? "—"}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
