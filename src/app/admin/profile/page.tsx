import type { Metadata } from "next";
import { connection } from "next/server";

import { requireStaff } from "@/lib/auth";
import { roleLabel } from "@/lib/roles";

import { ProfileForm } from "./profile-form";

export const metadata: Metadata = {
  title: "Profile settings",
};

export const instant = false;

export default async function AdminProfilePage() {
  await connection();

  const { user, profile } = await requireStaff("/admin/profile");

  return (
    <div className="mx-auto w-full max-w-3xl">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--brand)]">
          Account
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Profile settings</h1>
        <p className="mt-1.5 text-sm text-neutral-600">
          Update your display name and contact number. Roles and permissions can only be
          changed by Super Admin.
        </p>
      </header>

      <section className="mt-8 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Email</dt>
            <dd className="mt-1 break-all text-sm font-medium text-neutral-900">{user.email}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Role</dt>
            <dd className="mt-1 text-sm font-medium text-neutral-900">{roleLabel(profile.role)}</dd>
          </div>
        </dl>

        <ProfileForm fullName={profile.full_name ?? ""} phone={profile.phone ?? ""} />
      </section>
    </div>
  );
}
